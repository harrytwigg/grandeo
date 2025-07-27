import * as aws from "@pulumi/aws";
import type { PolicyDocument } from "@pulumi/aws/iam";

export const createPipeline = async () => {
	const { coreEnv, getCoreEnvSecret } = await import("./core-env");

	const artifactBucket = new aws.s3.Bucket("artifact-bucket", {
		acl: "private",
	});

	// Create proper trust policy for the pipeline role (who can assume it)
	const codePipelineTrustPolicy: PolicyDocument = {
		Version: "2012-10-17",
		Statement: [
			{
				Effect: "Allow",
				Principal: {
					Service: "codepipeline.amazonaws.com",
				},
				Action: "sts:AssumeRole",
			},
		],
	};

	const codePipelineRole = new aws.iam.Role("code-pipeline-role", {
		// Trust policy
		assumeRolePolicy: JSON.stringify(codePipelineTrustPolicy),
	});

	// Create separate permission policy for S3 access
	new aws.iam.RolePolicy("code-pipeline-s3-policy", {
		role: codePipelineRole.id,
		policy: artifactBucket.arn.apply((bucketArn) => {
			const policyDoc: PolicyDocument = {
				Version: "2012-10-17",
				Statement: [
					{
						Effect: "Allow",
						Action: ["s3:ListBucket"],
						Resource: bucketArn,
					},
					{
						Effect: "Allow",
						Action: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
						Resource: `${bucketArn}/*`,
					},
				],
			};
			return JSON.stringify(policyDoc);
		}),
	});

	// Create separate role for CodeBuild with correct trust policy
	const codeBuildTrustPolicy: PolicyDocument = {
		Version: "2012-10-17",
		Statement: [
			{
				Effect: "Allow",
				Principal: {
					Service: "codebuild.amazonaws.com",
				},
				Action: "sts:AssumeRole",
			},
		],
	};

	const codeBuildRole = new aws.iam.Role("code-build-role", {
		assumeRolePolicy: codeBuildTrustPolicy,
	});

	new aws.iam.RolePolicy("code-build-all-policy", {
		role: codeBuildRole.id,
		policy: {
			Version: "2012-10-17",
			Statement: [
				{
					Effect: "Allow",
					Action: "*",
					Resource: "*",
				},
			],
		},
	});

	const repoOutputName = "source-output";

	const buildProjectName = `dahlia-digital-build-project-${coreEnv.BRANCH}`;

	new aws.codepipeline.Pipeline("codepipeline", {
		name: `dahlia-digital-website-pipeline-${coreEnv.BRANCH}`,
		roleArn: codePipelineRole.arn,
		artifactStores: [
			{
				location: artifactBucket.bucket,
				type: "S3",
			},
		],
		stages: [
			{
				name: "Source",
				actions: [
					{
						name: "Source",
						category: "Source",
						owner: "ThirdParty",
						provider: "GitHub",
						version: "1",
						outputArtifacts: [repoOutputName],
						configuration: {
							Owner: coreEnv.GITHUB_OWNER,
							Repo: coreEnv.GITHUB_REPO,
							Branch: coreEnv.BRANCH,
							OAuthToken: getCoreEnvSecret("GITHUB_OAUTH_TOKEN"),
						},
						runOrder: 1,
					},
				],
			},
			{
				name: "Build",
				actions: [
					{
						name: "Build",
						category: "Build",
						owner: "AWS",
						provider: "CodeBuild",
						version: "1",
						inputArtifacts: [repoOutputName],
						configuration: {
							ProjectName: buildProjectName,
						},
						runOrder: 1,
					},
				],
			},
		],
	});

	const codeBuildSecret = await aws.ssm.getParameter({
		name: `/dahlia-digital-website/${getStage()}/infra-env`,
		withDecryption: true,
	});

	const buildProject = new aws.codebuild.Project("build-project", {
		name: buildProjectName,
		source: {
			type: "CODEPIPELINE",
		},
		artifacts: {
			type: "CODEPIPELINE",
		},
		serviceRole: codeBuildRole.arn,
		environment: {
			computeType: "BUILD_GENERAL1_SMALL",
			image: "aws/codebuild/standard:5.0",
			type: "LINUX_CONTAINER",
			environmentVariables: [
				{
					name: "PARAMETER_STORE_ENV_VARS",
					type: "PLAINTEXT",
					value: codeBuildSecret.arn,
				},
				{
					name: "BRANCH",
					type: "PLAINTEXT",
					value: coreEnv.BRANCH,
				},
				{
					name: "DEPLOY_STAGE",
					type: "PLAINTEXT",
					value: await getDeployStage(),
				},
			],
		},
	});

	// Add CodeBuild permissions to CodePipeline role
	new aws.iam.RolePolicy("code-pipeline-codebuild-policy", {
		role: codePipelineRole.id,
		policy: {
			Version: "2012-10-17",
			Statement: [
				{
					Effect: "Allow",
					Action: [
						"codebuild:StartBuild",
						"codebuild:BatchGetBuilds",
						"codebuild:StopBuild",
					],
					Resource: buildProject.arn,
				},
			],
		},
	});
};

const getDeployStage = async () => {
	const { coreEnv } = await import("./core-env");

	switch (coreEnv.BRANCH) {
		case "main":
			return "production";
		case "staging":
			return "staging";
		default:
			throw new Error(
				`Unknown branch: ${coreEnv.BRANCH}. Cannot determine deploy state.`,
			);
	}
};

const getStage = () => {
	const stageRaw = $app.stage;

	// Split so first bit before hyphen is the stage
	const stage = stageRaw.split("-")[0];

	return stage;
};

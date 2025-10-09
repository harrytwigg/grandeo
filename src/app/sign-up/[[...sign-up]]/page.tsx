import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-gray-50">
			<div className="w-full max-w-md space-y-8 px-4">
				<div className="text-center">
					<h1 className="font-bold text-3xl text-gray-900 tracking-tight">
						Grandeo
					</h1>
					<p className="mt-2 text-gray-600 text-sm">
						Create your account to get started
					</p>
				</div>
				<SignUp
					appearance={{
						elements: {
							rootBox: "mx-auto",
							card: "shadow-lg",
						},
					}}
				/>
			</div>
		</div>
	);
}

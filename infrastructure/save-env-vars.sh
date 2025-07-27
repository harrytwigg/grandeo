#!/bin/bash
set -e

# Check if the parameter store env var name is provided
if [ -z "${PARAMETER_STORE_ENV_VARS}" ]; then
  echo "Error: PARAMETER_STORE_ENV_VARS environment variable is not set"
  exit 1
fi

echo "Retrieving environment variables from SSM parameter: ${PARAMETER_STORE_ENV_VARS}"

# Get the parameter value from SSM and decrypt it
ENV_DATA=$(aws ssm get-parameter --name "${PARAMETER_STORE_ENV_VARS}" --with-decryption --query Parameter.Value --output text)

# Check if the retrieval was successful
if [ $? -ne 0 ]; then
  echo "Error: Failed to retrieve SSM parameter"
  exit 1
fi

# Create or clear the .env.local file
echo "# Environment variables from SSM parameter: ${PARAMETER_STORE_ENV_VARS}" > .env.local
echo "# Generated on $(date)" >> .env.local

# Process each line and export to environment
echo "Exporting environment variables and saving to .env.local..."
while IFS= read -r line; do
  # Skip empty lines and comments
  if [[ ! -z "$line" && ! "$line" =~ ^# ]]; then
    # Extract key and value
    key=$(echo "$line" | cut -d= -f1)
    value=$(echo "$line" | cut -d= -f2-)
    
    # Export to environment
    export "$key"="$value"
    
    # Save to .env.local file
    echo "$key=$value" >> .env.local
    
    echo "Exported and saved: $key"
  fi
done <<< "$ENV_DATA"

echo "Environment variables successfully exported and saved to .env.local"
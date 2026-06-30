$token = "vcp_4mhtR0oogUT4jqw4bIEKexntdJJ15TGTvCAz4r6puuXheHN45Z0jUYvq"
$scope = "team_PdCnZVBSNaOFdx5YxZsn5hys"

Write-Host "Adding NEXTAUTH_SECRET..."
npx vercel env add NEXTAUTH_SECRET production --value "dc62fff8da997e0447b5010b2f4644f46cea5effa936c0f9dedc68581b9b1e8c" --yes --scope $scope --token $token

Write-Host "Adding NEXTAUTH_URL..."
npx vercel env add NEXTAUTH_URL production --value "https://opshub-nanovest.vercel.app" --yes --scope $scope --token $token

Write-Host "Adding GROQ_API_KEY..."
npx vercel env add GROQ_API_KEY production --value "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" --yes --scope $scope --token $token

Write-Host "Adding HUGGINGFACE_API_KEY..."
npx vercel env add HUGGINGFACE_API_KEY production --value "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" --yes --scope $scope --token $token

Write-Host "Triggering new production deployment..."
npx vercel --prod --yes --scope $scope --token $token

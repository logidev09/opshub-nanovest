$token = "vcp_4mhtR0oogUT4jqw4bIEKexntdJJ15TGTvCAz4r6puuXheHN45Z0jUYvq"
$scope = "team_PdCnZVBSNaOFdx5YxZsn5hys"

Write-Host "1/5 Adding DATABASE_URL..."
npx vercel env add DATABASE_URL production --value "postgresql://postgres.gxodtccgjmzrwqdurxcc:Q80VsC4AuGOItspf@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres" --yes --scope $scope --token $token

Write-Host "2/5 Adding NEXTAUTH_SECRET..."
npx vercel env add NEXTAUTH_SECRET production --value "dc62fff8da997e0447b5010b2f4644f46cea5effa936c0f9dedc68581b9b1e8c" --yes --scope $scope --token $token

Write-Host "3/5 Adding NEXTAUTH_URL..."
npx vercel env add NEXTAUTH_URL production --value "https://opshub-nanovest.vercel.app" --yes --scope $scope --token $token

Write-Host "4/5 Adding GROQ_API_KEY..."
npx vercel env add GROQ_API_KEY production --value "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" --yes --scope $scope --token $token

Write-Host "5/5 Adding HUGGINGFACE_API_KEY..."
npx vercel env add HUGGINGFACE_API_KEY production --value "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" --yes --scope $scope --token $token

Write-Host "Deploying to Vercel production..."
npx vercel --prod --yes --scope $scope --token $token

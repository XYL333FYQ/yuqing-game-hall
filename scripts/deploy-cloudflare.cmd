@echo off
setlocal EnableExtensions
cd /d "%~dp0\.."

echo This deploys Yuqing Game Hall to the Cloudflare account currently signed in to Wrangler.
echo Review-only source repositories are excluded from the deployment package.
echo Press Ctrl+C now if the account, project name, or domain has not been confirmed.
pause

call corepack pnpm deploy:cloudflare
if errorlevel 1 (
  echo [ERROR] Deployment failed. Confirm Cloudflare login and retry.
  pause
  exit /b 1
)

echo Deployment completed.
pause
endlocal

$ErrorActionPreference = 'Continue'
cd 'c:\Users\david\Desktop\synk\synk-fixed'
npm start 2>&1 | Tee-Object -FilePath app-output.log

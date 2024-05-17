# How to enable build?
If you see build errors, claiming that it is not possible to run command line `grunt.ps1` because of the execution policy, it is necessary to run the following powershell script and to restart Visual Studio Code:

```ps
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
# QueryGantt
Query Gantt is an extension for the Azure DevOps, which enables you to view the result of the selected query in the form of a Gantt chart.

# How to enable build?
If you see build errors, claiming that it is not possible to run command line `grunt.ps1` because of the execution policy, it is necessary to run the following powershell script and to restart Visual Studio Code:

```ps
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

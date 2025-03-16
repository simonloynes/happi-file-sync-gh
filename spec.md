I’d like to build a github workflow action that,

- accepts a list of subject files  
  -- source file path  
  -- source filename  
  -- source wildcard (do not develop initially)
- accepts a list of target repositories  
  -- repo name  
  -- destination path  
  -- destination filename

If changes are detected in the subject files the action raises Pull Requests in the target repositories with the changes file

```
{
  [filename]: {
    sourcePath: "string",
    sourceFilename: "string",
    destPath: "string",
    destFilename: "string"
  }
}
```

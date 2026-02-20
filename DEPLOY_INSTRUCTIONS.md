# Deploy to GitHub

Your project is ready to deploy. The build passes and git is initialized with both `main` and `Development` branches.

## One-time setup: Create the GitHub repo

The GitHub MCP token cannot create repositories (403). Create the repo manually:

1. Go to [github.com/new](https://github.com/new)
2. Repository name: **better**
3. Leave it empty (no README, .gitignore, or license)
4. Click **Create repository**

## Push your branches

From the `better-app` folder:

```bash
cd /Users/clayton/Desktop/better/better-app

# Push main branch
git push -u origin main

# Push Development branch
git push -u origin Development
```

The remote `origin` is already set to `https://github.com/Clayton80024/better.git`.

## Optional: Rename main to Main

If you want the default branch to be `Main` (capital M):

```bash
git branch -m main Main
git push -u origin Main
# Then set Main as default in GitHub repo Settings → Branches
```

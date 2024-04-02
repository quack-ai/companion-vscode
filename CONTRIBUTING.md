# Contributing to Quack Companion 🦆

Everything you need to know to contribute efficiently to the project!

Whatever the way you wish to contribute to the project, please respect the [code of conduct](CODE_OF_CONDUCT.md).

## Codebase structure

- [`src/`](https://github.com/quack-ai/companion-vscode/blob/main/src/) - The actual platform codebase
- [`media/`](https://github.com/quack-ai/companion-vscode/blob/main/media/) - Binary assets & styling configs
- [`.vscode/`](https://github.com/quack-ai/companion-vscode/blob/main/.vscode/) - VSCode specific config
- [`.github/`](https://github.com/quack-ai/companion-vscode/blob/main/.github/) - Configuration for GitHub workflow

## Continuous Integration

This project uses the following integrations to ensure proper codebase maintenance:

- [Github Worklow](https://help.github.com/en/actions/configuring-and-managing-workflows/configuring-a-workflow) - run jobs for package build and coverage
- [Codacy](https://www.codacy.com/) - analyzes commits for code quality

As a contributor, you will only have to ensure coverage of your code by adding appropriate unit testing of your code.

## Developer installation

### Prerequisites

- [Node.js](https://nodejs.org/en)
- [Yarn](https://yarnpkg.com/getting-started/install)
- [VSCode](https://code.visualstudio.com/Download)
- [Make](https://www.gnu.org/software/make/) (optional)

### Configuration

When running the project, you can specify some configurations, which can be done using a `.env` file.
This file has no required keys but optionally, the following information can be added:

- `POSTHOG_KEY`: your key for analytics using PostHog
- `POSTHOG_HOST`: the URL of the Posthog host

So your `.env` file should look like something similar to:

```
POSTHOG_KEY='phc_my_fancy_posthog_key'
POSTHOG_HOST='https://app.posthog.com'
```

The file should be placed at the root folder of your local copy of the project.

## Feedback

### Feature requests & bug report

Whether you encountered a problem, or you have a feature suggestion, your input has value and can be used by contributors to reference it in their developments. For this purpose, we advise you to use Github [issues](https://github.com/quack-ai/companion-vscode/issues).

First, check whether the topic wasn't already covered in an open / closed issue. If not, feel free to open a new one! When doing so, use issue templates whenever possible and provide enough information for other contributors to jump in.

### Questions

If you are wondering how to do something with Contribution API, or a more general question, you should consider checking out Github [discussions](https://github.com/quack-ai/companion-vscode/discussions). See it as a Q&A forum, or the project-specific StackOverflow!

## Submitting a Pull Request

### Preparing your local branch

1 - Fork this [repository](https://github.com/quack-ai/companion-vscode) by clicking on the "Fork" button at the top right of the page. This will create a copy of the project under your GitHub account (cf. [Fork a repo](https://docs.github.com/en/get-started/quickstart/fork-a-repo)).

2 - [Clone your fork](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository) to your local disk and set the upstream to this repo

```shell
git clone git@github.com:<YOUR_GITHUB_ACCOUNT>/companion-vscode.git
cd companion-vscode
git remote add upstream https://github.com/quack-ai/companion-vscode.git
```

3 - You should not work on the `main` branch, so let's create a new one

```shell
git checkout -b a-short-description
```

### Developing your feature

#### Commits

- **Code**: make sure you provide docstrings & comments to your code.
- **Commit message**: please follow [Angular commit format](https://github.com/angular/angular/blob/main/CONTRIBUTING.md#-commit-message-format)

#### Code quality

To run all quality checks together

```shell
make quality
```

The previous command won't modify anything in your codebase. Some fixes (import ordering and code formatting) can be done automatically using the following command:

```shell
make style
```

#### Testing your modification

Before opening a PR, run your modifications locally with:

```shell
make run
```

Now by pressing F5, you'll open a new window with your local version of the extension loaded. Make sure it doesn't break previous behaviours.

### Submit your modifications

Commit your changes (for commit messages, use [Angular commit format](https://github.com/angular/angular/blob/main/CONTRIBUTING.md#-commit-message-format)):

```shell
git add <MODIFIED_FILE1> <MODIFIED_FILE2>
git commit -m '<COMMIT_MSG>'
```

Push your last modifications to your remote branch

```shell
git push -u origin a-short-description
```

Then [open a Pull Request](https://docs.github.com/en/github/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request) from your fork's branch. Follow the instructions of the Pull Request template and then click on "Create a pull request".

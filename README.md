# Zesty Deploy Pack

The Zesty ember-cli-deploy pack is an opinionated collection of ember-cli-deploy plugins used to manage continuous deployment at [Zesty](https://www.zesty.com/).

It relies on GitHub, CircleCI, Slack, S3 for assets and Redis for indexes.

## Installation

```
ember install ember-cli-deploy-zesty-pack
```

To update your config/deploy.js and .circleci/config.yml from our blueprint run

```
ember generate zesty-deploy-config
```

## Deploying to production

When master builds successfully, call `ember deploy production --activate` and notify slack.

## Deploying pull requests

When a pull request builds successfully, call `ember deploy pull-request` and add a comment on the PR with a link to the PR.

## Acknowledgements

This pack is heavily inspired by [ember-cli-deploy-lightning-pack](https://github.com/ember-cli-deploy/ember-cli-deploy-lightning-pack).

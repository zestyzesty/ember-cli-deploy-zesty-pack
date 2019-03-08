/* eslint-env node */
'use strict';

const inflected = require('inflected');
const Octokit = require('@octokit/rest');
const Promise = require('bluebird');
const { IncomingWebhook } = require('@slack/client');

function env(name) {
  if (process.env[name]) {
    return process.env[name];
  } else {
    throw new Error(`Expected environment variable ${name} to be set but it was not.`);
  }
}

function getPullRequestNumberFromURL(url) {
  const parts = url.split('/');
  const num = parseInt(parts[parts.length - 1]);

  if (num > 0) {
    return num;
  } else {
    throw new Error(`An invalid pull request URL was provided ${url}.`);
  }
}

function getSHAFromRedisKey(key) {
  const parts = key.split(':');
  const sha = parts[parts.length - 1];

  if (sha.length === 32) {
    return sha;
  } else {
    throw new Error(`An invalid redis key was provided ${key}. The SHA length was not 32 characters.`);
  }
}

function validatePublicURL(url) {
  if (!(typeof url === 'string' && url.indexOf('{{sha}}') !== -1)) {
    throw new Error('zesty.publicURL must be a string containing `{{sha}}`, e.g. "https://my.site.com?v={{sha}}".');
  }
}

module.exports = {
  name: 'ember-cli-deploy-zesty-plugin',

  createDeployPlugin: function(options) {
    return {
      name: 'zesty',

      configure: function(context) {
        if (process.env.CIRCLECI) {
          const zestyConfig = context.config[this.name] || {};

          if (context.deployTarget === 'production') {
            this.slackConfig = {
              webhookUrl: env('SLACK_WEBHOOK'),
              githubUser: env('CIRCLE_USERNAME')
            };
          }

          if (context.deployTarget === 'pull-request') {
            validatePublicURL(zestyConfig.publicURL);

            this.githubConfig = {
              token: env('GITHUB_TOKEN'),
              owner: env('CIRCLE_PROJECT_USERNAME'),
              repo: env('CIRCLE_PROJECT_REPONAME'),
              number: getPullRequestNumberFromURL(env('CIRCLE_PULL_REQUEST')),
              publicURLTemplate: zestyConfig.publicURL
            };
          }
        }
      },

      willActivate: function(context) {
        if (context.deployTarget === 'pull-request') {
          throw new Error('Aborting the deployment process. The `pull-request` deployment target should never be activated.');
        }
      },

      didActivate: function(context) {
        if (process.env.CIRCLECI) {
          if (context.deployTarget === 'production') {
            return this.notifySlackOfActivation(context);
          }
        }
      },

      didDeploy: function(context) {
        if (process.env.CIRCLECI) {
          if (context.deployTarget === 'pull-request') {
            return this.notifyPullRequestOfDeploy(context);
          }
        }
      },

      didFail: function(context) {
        if (process.env.CIRCLECI) {
          if (context.deployTarget === 'production') {
            return this.notifySlackOfFailure(context);
          }
        }
      },

      notifySlack: function(messagePayload) {
        const slackWebhook = new IncomingWebhook(this.slackConfig.webhookUrl);

        return new Promise(function(resolve, reject) {
          slackWebhook.send(messagePayload, function(error, result) {
            error ? reject(error) : resolve(result);
          });
        });
      },

      notifySlackOfActivation: function(context) {
        const { githubUser } = this.slackConfig;
        const projectName = context.project.name();
        const shortRev = context.revisionData.revisionKey.slice(0, 7);

        const text = `@${githubUser} deployed version ${shortRev} of ${projectName}.`;

        return this.notifySlack({ text });
      },

      notifySlackOfFailure: function(context) {
        return this.notifySlack({
          attachments: [{
            color: 'danger',
            text: 'Deploy failed.',
            fields: [
              { title: 'Revision', value: context.revisionData.revisionKey },
              { title: 'Triggered by', value: this.slackConfig.githubUser }
            ]
          }]
        });
      },

      notifyPullRequestOfDeploy: function(context) {
        const {
          number,
          publicURLTemplate,
          repo,
          token,
          owner
        } = this.githubConfig;

        const sha = getSHAFromRedisKey(context.redisKey);
        const url = publicURLTemplate.replace('{{sha}}', sha);
        const body = `Deployed to ${url}`;

        const octokit = new Octokit({
          auth: `token ${token}`,
          userAgent: owner // unsure of this.
        });

        return octokit.issues.createComment({
          owner,
          repo,
          number,
          body
        });
      }
    };
  }
};

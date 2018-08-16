/* jshint node: true */
'use strict';

var inflected = require('inflected');
var SlackApi = require('node-slackr');
var GitHubApi = require('github');
var Promise = require('bluebird');

function env(name) {
  if (process.env[name]) {
    return process.env[name];
  } else {
    throw new Error('Expected environment variable `' + name + '` to be set but it was not.');
  }
}

function getPullRequestNumberFromURL(url) {
  var parts = url.split('/');
  var num = parseInt(parts[parts.length - 1]);

  if (num > 0) {
    return num;
  } else {
    throw new Error('An invalid pull request URL was provided `' + url + '`.');
  }
}

function getSHAFromRedisKey(key) {
  var parts = key.split(':');
  var sha = parts[parts.length - 1];

  if (sha.length === 32) {
    return sha;
  } else {
    throw new Error('An invalid redis key was provided `' + key + '`. The SHA length was not 32 characters.');
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
          var zestyConfig = context.config[this.name] || {};

          if (context.deployTarget === 'production') {
            this.slackConfig = {
              webhook: env('SLACK_WEBHOOK'),
              channel: zestyConfig.slackChannel,
              githubUser: env('CIRCLE_USERNAME')
            };
          }

          if (context.deployTarget === 'pull-request') {
            validatePublicURL(zestyConfig.publicURL);

            this.githubConfig = {
              token: env('GITHUB_TOKEN'),
              user: env('CIRCLE_PROJECT_USERNAME'),
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

      notifySlack: function(context, messagePayload) {
        var name = context.project.name();
        var title = inflected.titleize(name);
        var deployTarget = inflected.titleize(context.deployTarget);

        var slack = new SlackApi(this.slackConfig.webhook, {
          channel: this.slackConfig.channel || '',
          username: 'Ember - ' + title + ' ' + deployTarget
        });

        return new Promise(function(resolve, reject) {
          slack.notify(messagePayload, function(error, result) {
            error ? reject(error) : resolve(result);
          });
        });
      },

      notifySlackOfActivation: function(context) {
        var projectName = context.project.name();
        var shortRev = context.revisionData.revisionKey.slice(0, 7);
        var text = "@" + this.slackConfig.githubUser + " deployed version " + shortRev + " of " + projectName + ".";

        return this.notifySlack(context, text);
      },

      notifySlackOfFailure: function(context) {
        return this.notifySlack(context, {
          attachments: [{
            color: 'danger',
            text: "Deploy failed.",
            fields: [
              { title: 'Revision', value: context.revisionData.revisionKey },
              { title: 'Triggered by', value: this.slackConfig.githubUser }
            ]
          }]
        });
      },

      notifyPullRequestOfDeploy: function(context) {
        var githubConfig = this.githubConfig;

        var sha = getSHAFromRedisKey(context.redisKey);
        var url = githubConfig.publicURLTemplate.replace('{{sha}}', sha);

        var body = "Deployed to " + url;

        var github = new GitHubApi({ version: '3.0.0' });

        github.authenticate({
          type: 'oauth',
          token: githubConfig.token
        });

        return new Promise(function(resolve, reject) {
          github.issues.createComment({
            user: githubConfig.user,
            repo: githubConfig.repo,
            number: githubConfig.number,
            body: body
          }, function(error, result) {
            error ? reject(error) : resolve(result);
          });
        });
      }
    };
  }
};

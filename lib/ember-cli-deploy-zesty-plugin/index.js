/* jshint node: true */
'use strict';

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
        var zestyConfig = context.config[this.name] || {};

        validatePublicURL(zestyConfig.publicURL);

        if (context.deployTarget === 'pull-request') {
          this.githubConfig = {
            token: env('GITHUB_TOKEN'),
            user: env('CIRCLE_PROJECT_USERNAME'),
            repo: env('CIRCLE_PROJECT_REPONAME'),
            number: getPullRequestNumberFromURL(env('CI_PULL_REQUEST')),
            publicURLTemplate: zestyConfig.publicURL
          }
        }
      },

      didDeploy: function(context) {
        if (context.deployTarget === 'pull-request') {
          return this.notifyPullRequestOfDeploy(context, this.githubConfig);
        }
      },

      notifyPullRequestOfDeploy: function(context, githubConfig) {
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

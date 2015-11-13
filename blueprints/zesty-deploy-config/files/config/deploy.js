/* jshint node: true */
'use strict';

function env(name) {
  if (process.env[name]) {
    return process.env[name];
  } else {
    throw new Error('Expected environment variable `' + name + '` to be set but it was not.');
  }
}

module.exports = function(deployTarget) {
  var ENV = {
    zesty: {
      publicURL: env('PUBLIC_URL')
    },

    build: {
      environment: 'production'
    },

    redis: {
      url: env('REDIS_URL'),
      allowOverwrite: true
    },

    s3: {
      accessKeyId: env('S3_ACCESS_KEY_ID'),
      secretAccessKey: env('S3_SECRET_ACCESS_KEY'),
      region: undefined,
      bucket: undefined
    }
  };

  if (deployTarget === 'production') {

    ENV.s3.region = env('PRODUCTION_REGION');
    ENV.s3.bucket = env('PRODUCTION_BUCKET');

  } else if (deployTarget === 'pull-request') {

    ENV.s3.region = env('PULL_REQUEST_REGION');
    ENV.s3.bucket = env('PULL_REQUEST_BUCKET');

  } else {

    throw new Error(
      "Invalid deploy target `" + deployTarget + "`. " +
      "Expected `production` or `pull-request`, e.g. " +
      "`ember deploy production`."
    );

  }

  return ENV;
};

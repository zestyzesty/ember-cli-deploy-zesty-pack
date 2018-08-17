var fs = require('fs');

module.exports = {
  description: 'Generate configuration for ember-cli-deploy-zesty-pack',
  locals(options) {
    return {
      bowerRequired: fs.existsSync('bower.json')
    };
  },
  normalizeEntityName: function() {}
};

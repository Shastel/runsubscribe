#!/usr/bin/env node
require('dotenv').config();

const ProgressBar = require('progress');

const commandLineArgs = require('command-line-args');
const octokit = require('@octokit/rest')();

const { star, pattern, secret } = commandLineArgs([
  { name: 'star', type: Boolean, },
  { name: 'pattern', type: String, defaultOption: '2018Q3' },
  { name: 'secret', type: String, defaultOption: process.env.GITHUB_OAUTH_KEY }
]);

if (!secret) {
  console.error('Param \'secret\' is missing');
  process.exit(1);
}

octokit.authenticate({
  type: 'oauth',
  token: secret,
});

if (star) {
  octokit.activity.starRepo({owner: 'Shastel', repo: 'runsubscribe'});
  console.log('Thanks =)');
}

function getProgressDefaults(total = 1) {
  return {
      complete: '=',
      incomplete: ' ',
      width: 20,
      total,
  };
}

const owner = 'rolling-scopes-school';

async function paginate (method, options) {
  const bar = new ProgressBar('Retrieving repos: [:bar] :percent :etas', getProgressDefaults());

  let response = await method(Object.assign({ per_page: 100 }, options));
  let { data } = response;

  while (octokit.hasNextPage(response)) {
    bar.total++;
    response = await octokit.getNextPage(response);
    bar.tick();
    data = data.concat(response.data)
  }

  bar.tick();

  return data;
}

paginate(octokit.repos.getForOrg, {
  org: owner,
  type: 'private'
}).then((data) => {
  return data.filter(({ name }) => name.indexOf(pattern) !== -1).map(({ name }) => name)
}).then((names) => {
  const bar = new ProgressBar('Unwatching repos: [:bar] :percent :etas', getProgressDefaults(names.length));

  names.reduce((R, repo) => {
    return R.then(() => {
      return octokit.activity.unwatchRepo({owner, repo}).then(() => {
        bar.tick();
      })
    });
  }, Promise.resolve());
});

#!/usr/bin/env node
require('dotenv').config();

const ProgressBar = require('progress');

const commandLineArgs = require('command-line-args');
const Octokit = require('@octokit/rest');

let { secret, pattern, star } = commandLineArgs([
  { name: 'pattern', type: String, alias: 'p', defaultOption: '2019Q1' },
  { name: 'secret', type: String, alias: 's' },
  { name: 'star', type: Boolean, alias: 't' },
]);

if (!secret && !process.env.GITHUB_OAUTH_KEY) {
  // eslint-disable-next-line
  console.error('Param \'secret\' is missing');
  process.exit(1);
}

const octokit = Octokit({
  auth: secret || process.env.GITHUB_OAUTH_KEY
});

if (star) {
  octokit.activity.starRepo({owner: 'Shastel', repo: 'runsubscribe'});
  // eslint-disable-next-line
  console.log('Thanks =)');
}

const owner = 'rolling-scopes-school';

let unwatchQueue = [];
const progress = new ProgressBar('Unwatching repos: [:bar] :percent :etas :current/:total', {
    complete: '=',
    incomplete: ' ',
    width: 20,
    total: 2,
});

function processPartial(patial) {
  const repos = patial.filter(({ name }) => name.indexOf(pattern) !== -1).map(({ name }) => name);

  progress.tick(0, {
    total: progress.total += repos.length,
  });

  unwatchQueue = unwatchQueue.concat(repos);

  return loadFromQueue();
}

async function loadFromQueue() {
  if (!unwatchQueue.length) {
    return;
  }

  const repo = unwatchQueue.shift();

  return octokit.activity.deleteRepoSubscription({owner, repo})
      .then(() => progress.tick())
      // Each unwatch req will trigger 2 new, it significant faster, but don't trigger abuse mechanism
      // In future can be uptadet to use 3 req at time
      .then(() => Promise.all([ loadFromQueue(), loadFromQueue() ]));
}

async function loadRepos() {

  let options = await octokit.repos.listForOrg.endpoint.merge(Object.assign({ per_page: 100 }, {
    org: owner,
    type: 'private'
  }));
  for await (const response of octokit.paginate.iterator(options)) {
    processPartial(response.data);
  }
}

loadRepos();

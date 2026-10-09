const assert = require('assert');

const Settings = require('../models/Settings');
const User = require('../models/User');
const discordService = require('../services/discordService');

async function run() {
  const originalGetSettings = Settings.getSettings;
  const originalFindOne = User.findOne;
  const originalEnsureReady = discordService.ensureReady;
  const originalClient = discordService.client;
  const sent = [];

  try {
    Settings.getSettings = async () => ({
      discordConfig: {
        enabled: true,
        mentionUsers: true,
        channels: {
          profileUpdates: 'main-channel',
          general: 'general-channel'
        }
      }
    });
    User.findOne = () => ({
      select: () => ({
        lean: async () => ({
          firstName: 'Campus',
          lastName: 'POC',
          discord: { userId: '123456789012345678' }
        })
      })
    });
    discordService.ensureReady = async () => true;
    discordService.client = {
      channels: {
        fetch: async (channelId) => ({
          id: channelId,
          send: async (payload) => {
            sent.push({ channelId, payload });
            return { id: `message-${sent.length}` };
          }
        })
      }
    };

    const campus = {
      _id: 'campus-1',
      name: 'Pune',
      discordChannelId: 'campus-channel'
    };
    const poc = await discordService.resolveCampusPoc(campus);
    assert.strictEqual(poc.discord.userId, '123456789012345678');

    const result = await discordService.sendProfileUpdate(
      {
        firstName: 'Student',
        lastName: 'Example',
        campus,
        discord: { userId: '' },
        studentProfile: {}
      },
      'approved',
      { firstName: 'Reviewer', lastName: 'Example' }
    );

    assert.strictEqual(result.deliveries.length, 2);
    assert.deepStrictEqual(sent.map((message) => message.channelId), [
      'main-channel',
      'campus-channel'
    ]);
    assert.strictEqual(sent[0].payload.content, '<@123456789012345678>');
    assert.deepStrictEqual(sent[0].payload.allowedMentions, {
      parse: [],
      users: ['123456789012345678']
    });

    sent.length = 0;
    Settings.getSettings = async () => ({
      discordConfig: { channels: { general: 'general-channel' } }
    });
    discordService.client = {
      channels: {
        fetch: async (channelId) => {
          if (channelId === 'missing-thread') throw new Error('Thread not found');
          return {
            id: channelId,
            send: async (payload) => {
              sent.push({ channelId, payload });
              return { id: `message-${sent.length}` };
            }
          };
        }
      }
    };
    const coordinatorResult = await discordService.sendCoordinatorMessage(
      {
        _id: 'job-1',
        title: 'Developer',
        company: { name: 'Example Co' },
        discordThreadId: 'missing-thread'
      },
      { firstName: 'Coordinator', lastName: 'Example' },
      [
        {
          _id: 'student-1',
          campus: { _id: 'campus-1', discordChannelId: 'campus-channel' },
          discord: { userId: '123456789012345678' }
        },
        {
          _id: 'student-2',
          campus: { _id: 'campus-1', discordChannelId: 'campus-channel' },
          discord: { userId: '123456789012345678' }
        }
      ],
      'Interview details have been updated.'
    );
    assert.strictEqual(coordinatorResult.threadDelivery.error, 'Thread not found');
    assert.deepStrictEqual(sent.map((message) => message.channelId), ['general-channel', 'campus-channel']);
    assert.strictEqual(sent[0].payload.content, '<@123456789012345678>');
    assert.deepStrictEqual(sent[0].payload.allowedMentions, {
      parse: [],
      users: ['123456789012345678']
    });

    sent.length = 0;
    Settings.getSettings = async () => ({
      discordConfig: { channels: { profileUpdates: 'main-channel' } }
    });
    discordService.client = {
      channels: {
        fetch: async () => {
          throw new Error('Discord unavailable');
        }
      }
    };
    const failureResult = await discordService.sendProfileUpdate(
      { firstName: 'Student', lastName: 'Example', campus: null, studentProfile: {} },
      'approved',
      { firstName: 'Reviewer', lastName: 'Example' }
    );
    assert.strictEqual(failureResult.deliveries[0].error, 'Discord unavailable');
  } finally {
    Settings.getSettings = originalGetSettings;
    User.findOne = originalFindOne;
    discordService.ensureReady = originalEnsureReady;
    discordService.client = originalClient;
  }
}

run().then(
  () => console.log('Discord notification tests passed'),
  (error) => {
    console.error(error);
    process.exitCode = 1;
  }
);

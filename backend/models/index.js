const { JobReadinessConfig, StudentJobReadiness, DEFAULT_CRITERIA } = require('./JobReadiness');

module.exports = {
  User: require('./User'),
  Campus: require('./Campus'),
  Skill: require('./Skill'),
  Job: require('./Job'),
  Application: require('./Application'),
  Notification: require('./Notification'),
  PlacementCycle: require('./PlacementCycle'),
  Settings: require('./Settings'),
  SelfApplication: require('./SelfApplication'),
  InterestRequest: require('./InterestRequest'),
  ATSAnalysis: require('./ATSAnalysis'),
  JobReadinessConfig,
  StudentJobReadiness,
  DEFAULT_CRITERIA
};

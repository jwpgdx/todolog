const { IOSConfig, withXcodeProject } = require('expo/config-plugins');

function updateTargetAttributes(project, appleTeamId) {
  const nativeTargets = IOSConfig.Target.getNativeTargets(project);
  const projectSection = IOSConfig.XcodeUtils.getProjectSection(project);

  Object.entries(projectSection)
    .filter(IOSConfig.XcodeUtils.isNotComment)
    .forEach(([, item]) => {
      const targetAttributes = item.attributes?.TargetAttributes;
      if (!targetAttributes) {
        return;
      }

      nativeTargets.forEach(([nativeTargetId]) => {
        if (!targetAttributes[nativeTargetId]) {
          targetAttributes[nativeTargetId] = {};
        }

        if (appleTeamId) {
          targetAttributes[nativeTargetId].DevelopmentTeam = appleTeamId;
          return;
        }

        delete targetAttributes[nativeTargetId].DevelopmentTeam;
      });
    });

  return project;
}

module.exports = function withLocalIosSigning(config) {
  return withXcodeProject(config, (configWithProject) => {
    const appleTeamId = configWithProject.ios?.appleTeamId;

    configWithProject.modResults = IOSConfig.DevelopmentTeam.updateDevelopmentTeamForPbxproj(
      configWithProject.modResults,
      appleTeamId
    );
    configWithProject.modResults = updateTargetAttributes(
      configWithProject.modResults,
      appleTeamId
    );

    return configWithProject;
  });
};

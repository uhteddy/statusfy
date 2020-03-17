const inquirer = require("inquirer");

const {
  logger,
  fse,
  grayMatter,
  LRU,
  path,
  Dates
} = require("@statusfy/common");
const loadConfig = require("./config/load");
const {
  getIncidentsFromProject,
  generateIncident
} = require("./utils/functions");

const cache = new LRU();
const dates = Dates();

const getIncidentData = async filePath => {
  const key = `data:${filePath}`;
  let data = cache.get(key);

  if (!data) {
    const fileContent = await fse.readFile(filePath);
    data = grayMatter.parse(fileContent);

    cache.set(key, data);
  }

  return data;
};

/* eslint-disable require-await */
module.exports = async function updateIncident(sourceDir, cliOptions = {}) {
  process.env.NODE_ENV = "development";

  const config = loadConfig(sourceDir).config;
  const contentDir = path.join(sourceDir, config.content.dir);
  const incidentsList = await getIncidentsFromProject(contentDir);

  const questions = [
    {
      type: "list",
      name: "incident",
      message: "What incident do you want to update?",
      paginated: true,
      choices: incidentsList
    },
    {
      type: "input",
      name: "title",
      message: "What's the title of the update?",
      validate: value => {
        if (value.length > 0) {
          return true;
        }

        return "You must have a cause title!";
      }
    },
	{
      type: "input",
      name: "description",
      message: "What's the message for the incident update?",
      validate: value => {
        if (value.length > 0) {
          return true;
        }

        return "You must have a cause title!";
      }
    },
    {
      type: "confirm",
      name: "confirm",
      message: "Are you sure you want to update the incident?",
      default: false
    }
  ];

  inquirer.prompt(questions).then(async answers => {
    const { incident, title, description, confirm } = answers;

    try {
      if (confirm) {
        const modified = dates.parse().toISOString();
        const locales = config.locales.map(l => l.code);
        const updatedFiles = [];
		const date = dates.parse().toISOString();
		
        for (let j = 0; j < locales.length; j++) {
          const locale = locales[j];
          const localeIncidentPath = path.join(
            contentDir,
            config.defaultLocale !== locale ? locale : "",
            incident.name
          );
          const exists = await fse.pathExists(localeIncidentPath);

          if (exists) {
            try {

              const content = `\n::: update ${title} | ${date}\n${description}\n:::`

              await fse.appendFileSync(localeIncidentPath, content)

              updatedFiles.push(localeIncidentPath);
            } catch (error) {
              logger.error(error);
            }
          } else {
            logger.warn(`This file couldn't be found:\n${localeIncidentPath}`);
          }
        }

        if (updatedFiles.length > 0) {
          const prefix =
            updatedFiles.length === 1
              ? "This file was successfully updated"
              : "These files were successfully updated";

          logger.success(`${prefix}: \n${updatedFiles.join("\n")}`);
        }
      }
    } catch (error) {
      logger.fatal(error);
    }
  });
};

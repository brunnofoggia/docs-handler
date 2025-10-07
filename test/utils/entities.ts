const isTestEnv = () => process.env.NODE_ENV === 'test' && (!process.env.TEST_DB_TYPE || process.env.TEST_DB_TYPE === 'sqlite');

const sqliteType = {
    json: 'text',
    jsonb: 'text',
    enum: 'simple-array',
    timestamptz: 'datetime',
};

const typeSettings = {
    datetime: (settings) => {
        settings.default = null;
        delete settings.onUpdate;
        return settings;
    },
    text: (settings) => {
        settings.default = null;
        return settings;
    },
};

const entities: any = {};
entities.column = (settings) => {
    if (isTestEnv()) {
        settings.type = sqliteType[settings.type] ?? settings.type;
        typeSettings[settings.type] && (settings = typeSettings[settings.type](settings));
    }
    return settings;
};

export const set = (settings, options = { type: 'column' }) => {
    if (!isTestEnv()) {
        return settings;
    }
    return entities[options.type] ? entities[options.type](settings) : settings;
};

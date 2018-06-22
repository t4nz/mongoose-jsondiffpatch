import * as jsondiffpatch from 'jsondiffpatch';
import { Document, Model, Mongoose, Schema, Types, Query } from 'mongoose';

import { HistoryDocument, HistorySchema } from './HistoryModel';
import omitDeep from './omitDeep';

export interface PluginOptions {
  mongoose: Mongoose;
  omit?: string | string[];
  [k: string]: any;
}

var History: Model<HistoryDocument>;

const diffPatcher = (jsondiffpatch as any).create({
  objectHash: (obj: any, idx: any) => obj._id || obj.id || `$$index: ${idx}`,
});

/**
 *
 * Compares documents and save a json diff object.
 * @param {Document} current Current document
 * @param {Document} orig Original document
 * @param {*} updates Update params
 * @param {*} pluginOpts Options passed by Mongoose Schema.plugin
 * @param {*} [meta] Extra meta data
 * @returns
 */
async function saveDiffObject(
  current: Document,
  orig: Document,
  updates: any = {},
  pluginOpts: PluginOptions,
  meta?: any,
) {
  const { __user: user, __reason: reason, __update: update } = meta || current;
  const { omit } = pluginOpts;

  try {
    let diff = diffPatcher.diff(JSON.parse(JSON.stringify(orig)), JSON.parse(JSON.stringify(updates)));
    if (omit) diff = omitDeep(diff, omit);

    if (!diff || !Object.keys(diff).length) return;

    const collectionId = current._id;
    const collectionName = (current as any).constructor.modelName;

    const last = await History.findOne({
      collectionId,
      collectionName,
    }).sort('-version');

    if (last && update === true) {
      Object.assign(last, { diff, user, reason });
      return last.save();
    }

    const history = new History({
      collectionId,
      collectionName,
      diff,
      user,
      reason,
      version: last ? last.version + 1 : 0,
    });
    return history.save();
  } catch (err) {
    throw err;
  }
}

/**
 *
 * Save differences
 * @param {Query<any>} query
 * @param {PluginOptions} pluginOpts
 */
async function saveDiffs(query: Query<any>, pluginOpts: PluginOptions) {
  const conditions = query.getQuery();
  const updates = query.getUpdate();
  const queryOptions = (query as any).options;

  try {
    await query
      .find(conditions)
      .lean(false)
      .cursor()
      .eachAsync(async document => {
        const changes = updates.$set || {};

        Object.keys(updates)
          .filter(k => !k.startsWith('$'))
          .forEach(k => {
            changes[k] = updates[k];
          });

        const orig = Object.assign({}, ...Object.keys(changes).map(k => ({ [k]: document[k] })));
        await saveDiffObject(document, orig, changes, pluginOpts, queryOptions);
      });
  } catch (err) {
    throw err;
  }
}

/**
 *
 * Returns an older version of a document.
 * @param {Model<Document>} this
 * @param {Types.ObjectId} id Unique object identifier
 * @param {(string | number)} version Number of version to retrieve
 * @param {*} [queryOpts] Query options
 * @returns
 */
async function getVersion(this: Model<Document>, id: Types.ObjectId, version: string | number, queryOpts?: any) {
  try {
    const latest = await this.findById(id, null, queryOpts);
    await History.find(
      {
        collectionName: this.modelName,
        collectionId: id,
        version: {
          $gte: typeof version === 'string' ? parseInt(version, 10) : version,
        },
      },
      {
        diff: 1,
        version: 1,
      },
      {
        sort: '-version',
      },
    )
      .lean()
      .cursor()
      .eachAsync(history => {
        diffPatcher.unpatch(latest, history.diff);
      });
    return latest || {};
  } catch (err) {
    throw err;
  }
}

/**
 *
 * Returns raw histories created for a document.
 * @param {Model<Document>} this
 * @param {Types.ObjectId} id Unique object identifier
 * @param {*} [queryOpts] Query options
 * @returns
 */
async function getDiffs(this: Model<Document>, id: Types.ObjectId, queryOpts?: any) {
  try {
    const histories = await History.find(
      {
        collectionName: this.modelName,
        collectionId: id,
      },
      null,
      queryOpts,
    )
      .lean()
      .exec();
    return histories;
  } catch (err) {
    throw err;
  }
}

/**
 * @param {Schema} schema Schema object passed by Mongoose Schema.plugin
 * @param {*} [opts] Options passed by Mongoose Schema.plugin
 * @param {Mongoose} [opts.mongoose] Mongoose instance to use
 * @param {string|string[]} [opts.omit] fields to omit from diffs (ex. ['a', 'b.c.d'])
 */
export default function mongooseJsonDiff(schema: Schema, pluginOpts: PluginOptions) {
  if (!pluginOpts || !pluginOpts.mongoose) {
    throw new Error('Please, pass mongoose while requiring mongoose-jsondiffpatch');
  }

  const { mongoose } = pluginOpts;
  History = mongoose.model('History', HistorySchema);

  schema.pre('save', async function(next) {
    if (this.isNew) return next();

    try {
      const orig = await this.collection.findOne({
        _id: this._id,
      });

      await saveDiffObject(this, orig, this.toJSON(), pluginOpts);
      next();
    } catch (err) {
      next(err);
    }
  });

  schema.pre('findOneAndUpdate', async function(next) {
    try {
      await saveDiffs(this, pluginOpts);
      next();
    } catch (err) {
      next(err);
    }
  });

  schema.pre('update', async function(next) {
    try {
      await saveDiffs(this, pluginOpts);
      next();
    } catch (err) {
      next(err);
    }
  });

  schema.pre('updateOne', async function(next) {
    try {
      await saveDiffs(this as Query<any>, pluginOpts);
      next();
    } catch (err) {
      next(err);
    }
  });

  schema.pre('remove', async function(next) {
    try {
      await saveDiffObject(this, this, {}, pluginOpts);
      next();
    } catch (err) {
      next(err);
    }
  });

  // assign a function to the "statics" object of schema
  schema.statics.getVersion = getVersion;
  schema.statics.getDiffs = getDiffs;
}

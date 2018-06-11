import * as jsondiffpatch from 'jsondiffpatch';
import { Document, Model, Mongoose, Promise, Schema, Types } from 'mongoose';

import { HistoryDocument, HistorySchema } from './HistoryModel';
import omit from './omitDeep';

var History: Model<HistoryDocument>;

const diffPatcher = (jsondiffpatch as any).create({
  objectHash: (obj: any, idx: any) => obj._id || obj.id || `$$index: ${idx}`,
});

/**
 *
 *
 * @param {Document} current Current document
 * @param {Document} orig Original document
 * @param {*} updated Updated document or update params
 * @param {*} opts Options passed by Mongoose Schema.plugin
 * @param {*} [meta] Extra meta data
 * @returns
 */
function saveDiffObject(current: Document, orig: Document, updated: any, opts: any, meta?: any) {
  const { __user: user, __reason: reason, __update: update } = meta || current;

  const diff = diffPatcher.diff(JSON.parse(JSON.stringify(orig)), JSON.parse(JSON.stringify(updated || {})));

  if (opts.omit) omit(diff, opts.omit);
  if (!diff || !Object.keys(diff).length) return Promise.resolve();

  const collectionId = current._id;
  const collectionName = (current as any).constructor.modelName;

  return History.findOne({
    collectionId,
    collectionName,
  })
    .sort('-version')
    .then(last => {
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
    });
}

/**
 *
 * Save differences
 * @param {*} query Query object
 * @param {*} opts Options passed by Mongoose Schema.plugin
 * @returns
 */
function saveDiffs(query: any, opts: any) {
  return query
    .find(query._conditions)
    .lean(false)
    .cursor()
    .eachAsync((result: any) => {
      const updates = query._update['$set'] || {};
      Object.keys(query._update).forEach(k => {
        if (!k.startsWith('$')) updates[k] = query._update[k];
      });

      const orig = Object.assign({}, ...Object.keys(updates).map(k => ({ [k]: result[k] })));
      return saveDiffObject(result, orig, updates, opts, query.options);
    });
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
function getVersion(this: Model<Document>, id: Types.ObjectId, version: string | number, queryOpts?: any) {
  return this.findById(id, null, queryOpts)
    .then(latest => {
      return History.find(
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
        })
        .then(() => latest || {});
    })
    .catch(err => {
      throw err;
    });
}

/**
 *
 * Returns raw histories created for a document.
 * @param {Model<Document>} this
 * @param {Types.ObjectId} id Unique object identifier
 * @param {*} [queryOpts] Query options
 * @returns
 */
function getDiffs(this: Model<Document>, id: Types.ObjectId, queryOpts?: any) {
  return History.find(
    {
      collectionName: this.modelName,
      collectionId: id,
    },
    null,
    queryOpts,
  )
    .lean()
    .exec()
    .then(histories => histories)
    .catch(err => {
      throw err;
    });
}

/**
 * @param {Schema} schema Schema object passed by Mongoose Schema.plugin
 * @param {*} [opts] Options passed by Mongoose Schema.plugin
 * @param {Mongoose} [opts.mongoose] Mongoose instance to use
 * @param {string|string[]} [opts.omit] fields to omit from diffs (ex. ['a', 'b.c.d'])
 */
export default function mongooseJsonDiff(schema: Schema, opts: any = {}) {
  if (opts.mongoose === undefined) {
    throw new Error('Please, pass mongoose while requiring mongoose-jsondiffpatch');
  }

  const mongoose: Mongoose = opts.mongoose;
  History = mongoose.model('History', HistorySchema);

  if (opts.omit && typeof opts.omit === 'string') {
    opts.omit = [opts.omit];
  }

  schema.pre('save', function(next) {
    if (this.isNew) return next();

    this.collection
      .findOne({
        _id: this._id,
      })
      .then(orig => saveDiffObject(this, orig, this, opts))
      .then(() => next())
      .catch(next);
  });

  schema.pre('findOneAndUpdate', function(next) {
    saveDiffs(this, opts)
      .then(() => next())
      .catch(next);
  });

  schema.pre('update', function(next) {
    saveDiffs(this, opts)
      .then(() => next())
      .catch(next);
  });

  schema.pre('updateOne', function(next) {
    saveDiffs(this, opts)
      .then(() => next())
      .catch(next);
  });

  schema.pre('remove', function(next) {
    saveDiffObject(this, this, null, opts)
      .then(() => next())
      .catch(next);
  });

  // assign a function to the "statics" object of schema
  schema.statics.getVersion = getVersion;
  schema.statics.getDiffs = getDiffs;
}

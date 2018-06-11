import { Schema } from 'mongoose';
/**
 * @param {Schema} schema Schema object passed by Mongoose Schema.plugin
 * @param {*} [opts] Options passed by Mongoose Schema.plugin
 * @param {Mongoose} [opts.mongoose] Mongoose instance to use
 * @param {string|string[]} [opts.omit] fields to omit from diffs (ex. ['a', 'b.c.d'])
 */
export default function mongooseJsonDiff(schema: Schema, opts?: any): void;

import * as isPlainObject from 'is-plain-object';

interface SourceObject {
  [key: string]: any;
}

type Source = SourceObject | SourceObject[];
type Paths = string | string[];

export default function omitDeep(source: Source, paths: Paths): Source {
  if (!source) return source;

  const keys = Array.isArray(paths) ? paths : [paths];
  if (!keys.length) return source;

  if (Array.isArray(source)) {
    return source.map<Source>(s => omitDeep(s, keys));
  }

  if (isPlainObject(source)) {
    keys.forEach(key => delete source[key]);
    Object.keys(source).forEach(key => {
      source[key] = omitDeep(source[key], paths);
    });
  }
  return source;
}

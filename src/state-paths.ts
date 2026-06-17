export function setNested(object: Record<string, unknown> | unknown[], path: string, value: unknown): void {
  const parts = parsePath(path);
  if (parts.length === 0) {
    throw new Error('State path cannot be empty');
  }

  let current: Record<string, unknown> | unknown[] = object;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    const nextKey = parts[index + 1];
    const currentValue = getChild(current, key);

    if (!isObjectLike(currentValue)) {
      setChild(current, key, /^\d+$/.test(nextKey) ? [] : {});
    }

    current = getChild(current, key) as Record<string, unknown> | unknown[];
  }

  setChild(current, parts[parts.length - 1], value);
}

function parsePath(path: string): string[] {
  return path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean);
}

function isObjectLike(value: unknown): value is Record<string, unknown> | unknown[] {
  return typeof value === 'object' && value !== null;
}

function getChild(object: Record<string, unknown> | unknown[], key: string): unknown {
  return Array.isArray(object) ? object[Number(key)] : object[key];
}

function setChild(object: Record<string, unknown> | unknown[], key: string, value: unknown): void {
  if (Array.isArray(object)) {
    object[Number(key)] = value;
    return;
  }
  object[key] = value;
}

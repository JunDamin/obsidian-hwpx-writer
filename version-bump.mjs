/**
 * Obsidian 플러그인 표준 버전 bump 스크립트.
 *
 * npm 이 `npm version <new>` 를 실행할 때 package.json 을 새 버전으로 갱신한 뒤
 * `npm run version` 을 호출한다 (package.json 의 scripts.version).
 * 이 파일은 그 훅에서 실행돼 manifest.json 과 versions.json 까지 동기화한다.
 *
 * 참고: https://docs.obsidian.md/Plugins/Releasing/Release+your+plugin+with+GitHub+Actions
 */
import { readFileSync, writeFileSync } from "node:fs";

const targetVersion = process.env.npm_package_version;
if (!targetVersion) {
  console.error("npm_package_version not set; run via `npm version`.");
  process.exit(1);
}

// manifest.json: version + minAppVersion 업데이트
const manifest = JSON.parse(readFileSync("manifest.json", "utf-8"));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t") + "\n");

// versions.json: 새 버전 → 필요한 Obsidian 최소 버전 매핑 추가
const versions = JSON.parse(readFileSync("versions.json", "utf-8"));
versions[targetVersion] = minAppVersion;
writeFileSync("versions.json", JSON.stringify(versions, null, "\t") + "\n");

console.log(`Bumped to ${targetVersion} (minAppVersion ${minAppVersion})`);

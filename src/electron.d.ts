declare module "electron" {
  export const shell: {
    openPath(path: string): Promise<string>;
    openExternal(url: string): Promise<void>;
    showItemInFolder(fullPath: string): void;
  };
}

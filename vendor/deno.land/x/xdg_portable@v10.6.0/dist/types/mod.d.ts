/** `XDG` (API) Determine XDG Base Directory paths (OS/platform portable). */
interface XDG {
    /** Create an `XDG` object (a preceding `new` is optional). */
    (): XDG;
    /** Create an `XDG` object (`new` is optional). */
    new (): XDG;
    /** Returns the directory path for user-specific non-essential (ie, cached) data files. */
    cache(): string;
    /** Returns the directory path for user-specific configuration files.	*/
    config(): string;
    /** Returns directory path for user-specific data files. */
    data(): string;
    /**	Returns the directory path for user-specific non-essential runtime files (such as sockets, named pipes, etc); may be `undefined`. */
    runtime(): string | undefined;
    /** Returns the directory path for user-specific state files (non-essential and more volatile than configuration files). */
    state(): string;
    /** Returns a preference-ordered array of base directory paths to search for configuration files (includes `.config()` directory as first entry). */
    configDirs(): readonly string[];
    /** Returns a preference-ordered array of base directory paths to search for data files (includes `.data()` directory as first entry). */
    dataDirs(): readonly string[];
}

declare const _: XDG;

export { XDG, _ as default };

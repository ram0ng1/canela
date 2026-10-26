export interface BugReportsOptions {
    button: boolean;
    console: boolean;
    full: boolean;
}
export declare const options: () => BugReportsOptions | null;
export default function installBugReports(): void;

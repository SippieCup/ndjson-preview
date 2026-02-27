export interface Filter {
    key: string;
    value: string;
}

export interface PreviewState {
    reorderKeys: boolean;
    wordWrap: boolean;
    uriDecode: boolean;
    customOrder: string[];
    activeFilters: Filter[];
}

export interface WebviewContentOptions {
    json: unknown;
    lineNumber: number;
    isError: boolean;
    reorderEnabled: boolean;
    wordWrapEnabled: boolean;
    uriDecodeEnabled: boolean;
    customOrder: string[];
    filters: Filter[];
}

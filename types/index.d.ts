export const XMLCAGE_VERSION: '1.0.0';

export const XMLCAGE_ERROR_CODES: {
  readonly DOCTYPE_FORBIDDEN: 'XMLCAGE_DOCTYPE_FORBIDDEN';
  readonly ENTITY_FORBIDDEN: 'XMLCAGE_ENTITY_FORBIDDEN';
  readonly EXTERNAL_ID_FORBIDDEN: 'XMLCAGE_EXTERNAL_ID_FORBIDDEN';
  readonly NOTATION_FORBIDDEN: 'XMLCAGE_NOTATION_FORBIDDEN';
  readonly ATTLIST_FORBIDDEN: 'XMLCAGE_ATTLIST_FORBIDDEN';
  readonly ELEMENT_DECLARATION_FORBIDDEN: 'XMLCAGE_ELEMENT_DECLARATION_FORBIDDEN';
  readonly UNKNOWN_ENTITY: 'XMLCAGE_UNKNOWN_ENTITY';
  readonly ILLEGAL_CHAR_REF: 'XMLCAGE_ILLEGAL_CHAR_REF';
  readonly XINCLUDE_FORBIDDEN: 'XMLCAGE_XINCLUDE_FORBIDDEN';
  readonly PROCESSING_INSTRUCTION_FORBIDDEN: 'XMLCAGE_PROCESSING_INSTRUCTION_FORBIDDEN';
  readonly EXTERNAL_SCHEMA_FORBIDDEN: 'XMLCAGE_EXTERNAL_SCHEMA_FORBIDDEN';
  readonly DUPLICATE_ATTRIBUTE: 'XMLCAGE_DUPLICATE_ATTRIBUTE';
  readonly PROTOTYPE_KEY: 'XMLCAGE_PROTOTYPE_KEY';
  readonly MAX_DEPTH: 'XMLCAGE_MAX_DEPTH';
  readonly MAX_BYTES: 'XMLCAGE_MAX_BYTES';
  readonly MAX_ELEMENTS: 'XMLCAGE_MAX_ELEMENTS';
  readonly MAX_ATTRIBUTES: 'XMLCAGE_MAX_ATTRIBUTES';
  readonly MAX_TEXT_LENGTH: 'XMLCAGE_MAX_TEXT_LENGTH';
  readonly MAX_ATTRIBUTE_VALUE_LENGTH: 'XMLCAGE_MAX_ATTRIBUTE_VALUE_LENGTH';
  readonly MAX_NAME_LENGTH: 'XMLCAGE_MAX_NAME_LENGTH';
  readonly MAX_COMMENTS: 'XMLCAGE_MAX_COMMENTS';
  readonly MAX_ENTITY_REFERENCES: 'XMLCAGE_MAX_ENTITY_REFERENCES';
  readonly MAX_EXPANDED_TEXT_BYTES: 'XMLCAGE_MAX_EXPANDED_TEXT_BYTES';
  readonly MAX_PROCESSING_INSTRUCTIONS: 'XMLCAGE_MAX_PROCESSING_INSTRUCTIONS';
  readonly INVALID_UTF8: 'XMLCAGE_INVALID_UTF8';
  readonly MALFORMED_XML: 'XMLCAGE_MALFORMED_XML';
  readonly ENCODING_MISMATCH: 'XMLCAGE_ENCODING_MISMATCH';
  readonly INVALID_INPUT: 'XMLCAGE_INVALID_INPUT';
  readonly INVALID_OPTIONS: 'XMLCAGE_INVALID_OPTIONS';
  readonly UNSUPPORTED_VALUE: 'XMLCAGE_UNSUPPORTED_VALUE';
  readonly CYCLE_DETECTED: 'XMLCAGE_CYCLE_DETECTED';
};

export const CODE: typeof XMLCAGE_ERROR_CODES;

export type XmlCageErrorCode = typeof XMLCAGE_ERROR_CODES[keyof typeof XMLCAGE_ERROR_CODES];

export class XmlCageError extends Error {
  constructor(code: XmlCageErrorCode, message: string, details?: Record<string, unknown>);
  readonly code: XmlCageErrorCode;
  readonly reason: string;
  readonly position?: number;
  readonly line?: number;
  readonly column?: number;
  readonly xmlName?: string;
  readonly attribute?: string;
  readonly key?: string;
  readonly limit?: number;
  readonly actual?: number | string;
  readonly depth?: number;
  readonly expected?: string;
  findings?: readonly XmlCageFinding[];
  stats?: XmlCageStats;
  toJSON(): Record<string, unknown>;
}

export interface XmlCageOptions {
  allowDoctype?: boolean;
  allowXInclude?: boolean;
  allowProcessingInstructions?: boolean;
  allowXmlStylesheet?: boolean;
  allowExternalSchemaLocations?: boolean;
  maxBytes?: number;
  maxDepth?: number;
  maxElements?: number;
  maxAttributesPerElement?: number;
  maxTotalAttributes?: number;
  maxTextLength?: number;
  maxAttributeValueLength?: number;
  maxNameLength?: number;
  maxComments?: number;
  maxEntityReferences?: number;
  maxExpandedTextBytes?: number;
  maxProcessingInstructions?: number;
  maxFindings?: number;
}

export interface XmlCageSerializeOptions extends XmlCageOptions {
  xmlDeclaration?: boolean;
}

export interface XmlCageFinding {
  readonly code: XmlCageErrorCode;
  readonly message: string;
  readonly position?: number;
  readonly line?: number;
  readonly column?: number;
  readonly limit?: number;
  readonly actual?: number | string;
  readonly depth?: number;
  readonly xmlName?: string;
  readonly attribute?: string;
  readonly key?: string;
  readonly expected?: string;
  readonly parameter?: boolean;
}

export interface XmlCageStats {
  readonly bytes: number;
  readonly elements: number;
  readonly maxDepthObserved: number;
  readonly attributes: number;
  readonly textCharacters: number;
  readonly comments: number;
  readonly cdataSections: number;
  readonly processingInstructions: number;
  readonly entityReferences: number;
  readonly expandedTextBytes: number;
}

export interface XmlCageAuditReport {
  readonly safe: boolean;
  readonly findings: readonly XmlCageFinding[];
  readonly stats: XmlCageStats;
}

export interface XmlDeclarationNode {
  readonly version: '1.0';
  readonly encoding: 'UTF-8' | null;
  readonly standalone: boolean | null;
}

export interface XmlAttributeNode {
  readonly name: string;
  readonly localName: string;
  readonly prefix: string | null;
  readonly namespaceURI: string | null;
  readonly value: string;
}

export interface XmlElementNode {
  readonly type: 'element';
  readonly name: string;
  readonly localName: string;
  readonly prefix: string | null;
  readonly namespaceURI: string | null;
  readonly attributes: Readonly<Record<string, string>>;
  readonly attributeList: readonly XmlAttributeNode[];
  readonly children: readonly XmlNode[];
  readonly depth: number;
}

export interface XmlTextNode {
  readonly type: 'text';
  readonly value: string;
}

export interface XmlCdataNode {
  readonly type: 'cdata';
  readonly value: string;
}

export interface XmlCommentNode {
  readonly type: 'comment';
  readonly value: string;
}

export interface XmlProcessingInstructionNode {
  readonly type: 'processing-instruction';
  readonly target: string;
  readonly data: string;
}

export type XmlNode =
  | XmlElementNode
  | XmlTextNode
  | XmlCdataNode
  | XmlCommentNode
  | XmlProcessingInstructionNode;

export interface XmlDocumentNode {
  readonly type: 'document';
  readonly xmlDeclaration: XmlDeclarationNode | null;
  readonly root: XmlElementNode | null;
  readonly prolog: readonly XmlNode[];
  readonly epilog: readonly XmlNode[];
  readonly children: readonly XmlNode[];
}

export type XmlByteInput = Uint8Array | ArrayBuffer | ArrayBufferView;

export interface XmlSerializableAttribute {
  readonly name: string;
  readonly value: string;
}

export interface XmlSerializableElement {
  readonly type?: 'element';
  readonly name?: string;
  readonly tag?: string;
  readonly tagName?: string;
  readonly attributes?: Readonly<Record<string, string>>;
  readonly attributeList?: readonly XmlSerializableAttribute[];
  readonly children?: readonly XmlSerializableNode[];
  readonly content?: string;
  readonly text?: string;
}

export interface XmlSerializableDocument {
  readonly type?: 'document';
  readonly xmlDeclaration?: Partial<XmlDeclarationNode> | null;
  readonly root?: XmlSerializableElement | XmlElementNode | null;
  readonly children?: readonly XmlSerializableNode[];
}

export interface XmlSerializableText {
  readonly type: 'text';
  readonly value: string;
}

export interface XmlSerializableCdata {
  readonly type: 'cdata';
  readonly value: string;
}

export interface XmlSerializableComment {
  readonly type: 'comment';
  readonly value: string;
}

export interface XmlSerializableProcessingInstruction {
  readonly type: 'processing-instruction';
  readonly target: string;
  readonly data: string;
}

export type XmlSerializableNode =
  | string
  | XmlSerializableElement
  | XmlSerializableDocument
  | XmlSerializableText
  | XmlSerializableCdata
  | XmlSerializableComment
  | XmlSerializableProcessingInstruction
  | XmlNode
  | XmlDocumentNode;

export type XmlSerializableRoot =
  | XmlSerializableElement
  | XmlSerializableDocument
  | XmlElementNode
  | XmlDocumentNode;

export function auditXml(input: string | XmlByteInput, options?: XmlCageOptions): XmlCageAuditReport;
export function assertSafeXml(input: string | XmlByteInput, options?: XmlCageOptions): XmlCageAuditReport;
export function parseSafeXml(input: string, options?: XmlCageOptions): XmlDocumentNode;
export function parseSafeXmlBytes(input: XmlByteInput, options?: XmlCageOptions): XmlDocumentNode;
export function escapeXmlText(value: string): string;
export function escapeXmlAttr(value: string): string;
export function serializeSafeXml(input: XmlSerializableRoot, options?: XmlCageSerializeOptions): string;

export interface XmlCage {
  readonly options: Required<XmlCageOptions>;
  audit(input: string | XmlByteInput, overrides?: XmlCageOptions): XmlCageAuditReport;
  assert(input: string | XmlByteInput, overrides?: XmlCageOptions): XmlCageAuditReport;
  parse(input: string, overrides?: XmlCageOptions): XmlDocumentNode;
  parseBytes(input: XmlByteInput, overrides?: XmlCageOptions): XmlDocumentNode;
  escapeText(value: string): string;
  escapeAttr(value: string): string;
  serialize(input: XmlSerializableRoot, overrides?: XmlCageSerializeOptions): string;
}

export function createXmlCage(defaultOptions?: XmlCageOptions): XmlCage;

declare const xmlcage: {
  readonly XMLCAGE_VERSION: typeof XMLCAGE_VERSION;
  readonly XMLCAGE_ERROR_CODES: typeof XMLCAGE_ERROR_CODES;
  readonly CODE: typeof CODE;
  readonly XmlCageError: typeof XmlCageError;
  readonly auditXml: typeof auditXml;
  readonly assertSafeXml: typeof assertSafeXml;
  readonly parseSafeXml: typeof parseSafeXml;
  readonly parseSafeXmlBytes: typeof parseSafeXmlBytes;
  readonly createXmlCage: typeof createXmlCage;
  readonly escapeXmlText: typeof escapeXmlText;
  readonly escapeXmlAttr: typeof escapeXmlAttr;
  readonly serializeSafeXml: typeof serializeSafeXml;
};

export default xmlcage;

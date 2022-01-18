/**
 * (?<start> \k<item>* )
 * (?<item> \k<non-escape> | \k<escape> | \k<interpolate> )
 * (?<non-escape> [^\{] )
 * (?<escape> \{\{ )
 * (?<interpolate> \{ \k<parameter> \} )
 * (?<parameter> \k<name> ( : \k<type> )? | [^\}]*)
 * (?<name> [^\}:]*)
 * (?<type> string | number | boolean)
 */

type parseItems<message extends string> = parse;
/** @internal */
export type parseTemplateMessageToData<message extends string> =
    parseItems<message>;

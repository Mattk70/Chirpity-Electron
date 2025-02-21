var q=null;window.PR_SHOULD_USE_CONTINUATION=!0;
(function(){/**
 * Combines multiple regular expressions into one unified regular expression.
 *
 * Each provided regular expression is converted into a non-capturing group and concatenated using alternation.
 * All input regular expressions must not use the global or multiline flags; otherwise, an error is thrown.
 * The resulting regular expression always uses the global flag and includes the ignoreCase flag if any input pattern is case-insensitive.
 *
 * @param {RegExp[]} a - An array of regular expressions to combine.
 * @returns {RegExp} A unified regular expression that matches any of the provided patterns.
 *
 * @throws {Error} If any input regular expression has the global or multiline flag set.
 */
function L(a){function m(a){var f=a.charCodeAt(0);if(f!==92)return f;var b=a.charAt(1);return(f=r[b])?f:"0"<=b&&b<="7"?parseInt(a.substring(1),8):b==="u"||b==="x"?parseInt(a.substring(2),16):a.charCodeAt(1)}function e(a){if(a<32)return(a<16?"\\x0":"\\x")+a.toString(16);a=String.fromCharCode(a);if(a==="\\"||a==="-"||a==="["||a==="]")a="\\"+a;return a}function h(a){for(var f=a.substring(1,a.length-1).match(/\\u[\dA-Fa-f]{4}|\\x[\dA-Fa-f]{2}|\\[0-3][0-7]{0,2}|\\[0-7]{1,2}|\\[\S\s]|[^\\]/g),a=
[],b=[],o=f[0]==="^",c=o?1:0,i=f.length;c<i;++c){var j=f[c];if(/\\[bdsw]/i.test(j))a.push(j);else{var j=m(j),d;c+2<i&&"-"===f[c+1]?(d=m(f[c+2]),c+=2):d=j;b.push([j,d]);d<65||j>122||(d<65||j>90||b.push([Math.max(65,j)|32,Math.min(d,90)|32]),d<97||j>122||b.push([Math.max(97,j)&-33,Math.min(d,122)&-33]))}}b.sort(function(a,f){return a[0]-f[0]||f[1]-a[1]});f=[];j=[NaN,NaN];for(c=0;c<b.length;++c)i=b[c],i[0]<=j[1]+1?j[1]=Math.max(j[1],i[1]):f.push(j=i);b=["["];o&&b.push("^");b.push.apply(b,a);for(c=0;c<
f.length;++c)i=f[c],b.push(e(i[0])),i[1]>i[0]&&(i[1]+1>i[0]&&b.push("-"),b.push(e(i[1])));b.push("]");return b.join("")}function y(a){for(var f=a.source.match(/\[(?:[^\\\]]|\\[\S\s])*]|\\u[\dA-Fa-f]{4}|\\x[\dA-Fa-f]{2}|\\\d+|\\[^\dux]|\(\?[!:=]|[()^]|[^()[\\^]+/g),b=f.length,d=[],c=0,i=0;c<b;++c){var j=f[c];j==="("?++i:"\\"===j.charAt(0)&&(j=+j.substring(1))&&j<=i&&(d[j]=-1)}for(c=1;c<d.length;++c)-1===d[c]&&(d[c]=++t);for(i=c=0;c<b;++c)j=f[c],j==="("?(++i,d[i]===void 0&&(f[c]="(?:")):"\\"===j.charAt(0)&&
(j=+j.substring(1))&&j<=i&&(f[c]="\\"+d[i]);for(i=c=0;c<b;++c)"^"===f[c]&&"^"!==f[c+1]&&(f[c]="");if(a.ignoreCase&&s)for(c=0;c<b;++c)j=f[c],a=j.charAt(0),j.length>=2&&a==="["?f[c]=h(j):a!=="\\"&&(f[c]=j.replace(/[A-Za-z]/g,function(a){a=a.charCodeAt(0);return"["+String.fromCharCode(a&-33,a|32)+"]"}));return f.join("")}for(var t=0,s=!1,l=!1,p=0,d=a.length;p<d;++p){var g=a[p];if(g.ignoreCase)l=!0;else if(/[a-z]/i.test(g.source.replace(/\\u[\da-f]{4}|\\x[\da-f]{2}|\\[^UXux]/gi,""))){s=!0;l=!1;break}}for(var r=
{b:8,t:9,n:10,v:11,f:12,r:13},n=[],p=0,d=a.length;p<d;++p){g=a[p];if(g.global||g.multiline)throw Error(""+g);n.push("(?:"+y(g)+")")}return RegExp(n.join("|"),l?"gi":"g")}/**
 * Extracts and normalizes text content from a DOM node along with a mapping of text offsets to their originating nodes.
 *
 * Recursively traverses the DOM tree rooted at the given node, concatenating text from text and CDATA nodes into
 * a single string while preserving or compressing whitespace based on the computed white-space property. Newline
 * characters are explicitly inserted for <BR> and <LI> elements. Nodes with a class matching "nocode" are skipped.
 *
 * @param {Node} a - The root DOM node to process.
 * @returns {{a: string, c: Array}} An object containing:
 *   - a: The accumulated and normalized text content with trailing newline removed.
 *   - c: An array of marker pairs where each pair maps a text offset to the corresponding DOM node.
 */
function M(a){function m(a){switch(a.nodeType){case 1:if(e.test(a.className))break;for(var g=a.firstChild;g;g=g.nextSibling)m(g);g=a.nodeName;if("BR"===g||"LI"===g)h[s]="\n",t[s<<1]=y++,t[s++<<1|1]=a;break;case 3:case 4:g=a.nodeValue,g.length&&(g=p?g.replace(/\r\n?/g,"\n"):g.replace(/[\t\n\r ]+/g," "),h[s]=g,t[s<<1]=y,y+=g.length,
t[s++<<1|1]=a)}}var e=/(?:^|\s)nocode(?:\s|$)/,h=[],y=0,t=[],s=0,l;a.currentStyle?l=a.currentStyle.whiteSpace:window.getComputedStyle&&(l=document.defaultView.getComputedStyle(a,q).getPropertyValue("white-space"));var p=l&&"pre"===l.substring(0,3);m(a);return{a:h.join("").replace(/\n$/,""),c:t}}/**
 * Accumulates tokens into an output array when a marker is provided.
 *
 * Constructs a token object that includes a marker (stored under the property `a`) and previous context (stored under `d`). The provided callback is then invoked with this token object, expected to populate an array of tokens under the `e` property. Finally, tokens from this array are appended individually to the output array.
 *
 * @param {*} a - Context or prior state; later stored under `d` in the constructed token object.
 * @param {*} m - Marker used to trigger token processing; if truthy, it is set as the `a` property of the newly constructed token object.
 * @param {Function} e - Callback function that receives the token object. It should augment the token object (for example, by setting its `e` property to an array of tokens).
 * @param {Array} h - Output array that accumulates tokens. The tokens from the token object’s `e` property are appended to this array.
 */
function B(a,m,e,h){m&&(a={a:m,d:a},e(a),h.push.apply(h,a.e))}/**
 * Returns a lexer function that applies syntax highlighting rules based on the provided
 * primary and supplementary token definitions.
 *
 * Combines token definitions from both arrays into a master regular expression that
 * is used to tokenize input code segments. The returned function processes an object
 * with a string to be tokenized (property "a") and a starting offset or identifier (property "d").
 * It analyzes the text using the combined patterns, assigns token types (e.g., plain, language-specific),
 * and constructs an array of highlighted tokens that is stored in the object's "e" property.
 *
 * @param {Array} a - Primary token definitions. Each element should be an array where index 1
 *   is a regular expression used for matching tokens and index 3 (if defined) is a string of special characters.
 * @param {Array} m - Supplementary token definitions that augment or override the primary definitions.
 *   Each element is expected to be an array with a token type identifier at index 0 and a regular
 *   expression at index 1.
 * @returns {function(Object): void} A lexer function that tokenizes a given code segment object.
 *
 * @example
 * const primaryTokens = [
 *   // e.g., ["lang-js", /.../, ... , "jsKeywords"]
 * ];
 * const supplementaryTokens = [
 *   // e.g., ["kwd", /\b(function|return)\b/, ...]
 * ];
 * const lexer = x(primaryTokens, supplementaryTokens);
 * const codeSegment = { d: 0, a: "function example() { return 42; }" };
 * lexer(codeSegment);
 * console.log(codeSegment.e); // Array of tokens with assigned types.
 */
function x(a,m){function e(a){for(var l=a.d,p=[l,"pln"],d=0,g=a.a.match(y)||[],r={},n=0,z=g.length;n<z;++n){var f=g[n],b=r[f],o=void 0,c;if(typeof b===
"string")c=!1;else{var i=h[f.charAt(0)];if(i)o=f.match(i[1]),b=i[0];else{for(c=0;c<t;++c)if(i=m[c],o=f.match(i[1])){b=i[0];break}o||(b="pln")}if((c=b.length>=5&&"lang-"===b.substring(0,5))&&!(o&&typeof o[1]==="string"))c=!1,b="src";c||(r[f]=b)}i=d;d+=f.length;if(c){c=o[1];var j=f.indexOf(c),k=j+c.length;o[2]&&(k=f.length-o[2].length,j=k-c.length);b=b.substring(5);B(l+i,f.substring(0,j),e,p);B(l+i+j,c,C(b,c),p);B(l+i+k,f.substring(k),e,p)}else p.push(l+i,b)}a.e=p}var h={},y;(function(){for(var e=a.concat(m),
l=[],p={},d=0,g=e.length;d<g;++d){var r=e[d],n=r[3];if(n)for(var k=n.length;--k>=0;)h[n.charAt(k)]=r;r=r[1];n=""+r;p.hasOwnProperty(n)||(l.push(r),p[n]=q)}l.push(/[\S\s]/);y=L(l)})();var t=m.length;return e}/**
 * Compiles language-specific token definitions for syntax highlighting.
 *
 * Produces two arrays of token definitions for primary and secondary patterns based on the provided language configuration.
 * Patterns include those for string literals (supporting triple-quoted, multi-line, or standard forms), verbatim strings,
 * hash and C-style comments, regex literals, type identifiers, keywords, numeric literals, and punctuation.
 *
 * @param {Object} a - The language configuration object.
 * @param {boolean} [a.tripleQuotedStrings] - Enables support for triple-quoted string literals.
 * @param {boolean} [a.multiLineStrings] - Enables support for multi-line string literals, including backtick-delimited strings.
 * @param {boolean} [a.verbatimStrings] - Enables support for verbatim string literals (e.g., @"...").
 * @param {number|boolean} [a.hashComments] - Enables hash comment support. A numeric value greater than 1 applies extended hash comment patterns.
 * @param {boolean} [a.cStyleComments] - Enables support for C-style comments (e.g., // and /* ... *​/).
 * @param {boolean} [a.regexLiterals] - Enables detection of regex literal tokens.
 * @param {RegExp|string} [a.types] - Custom pattern or identifier used to match type definitions.
 * @param {string} [a.keywords] - A whitespace or comma-separated list of language keywords.
 *
 * @returns {*} Configured lexer specification created from the compiled token definitions.
 *
 * @example
 * const config = {
 *   tripleQuotedStrings: true,
 *   multiLineStrings: false,
 *   verbatimStrings: false,
 *   hashComments: 1,
 *   cStyleComments: true,
 *   regexLiterals: true,
 *   types: "\\b[A-Z][a-z]+\\b",
 *   keywords: "if else while return"
 * };
 * const lexerSpec = u(config);
 */
function u(a){var m=[],e=[];a.tripleQuotedStrings?m.push(["str",/^(?:'''(?:[^'\\]|\\[\S\s]|''?(?=[^']))*(?:'''|$)|"""(?:[^"\\]|\\[\S\s]|""?(?=[^"]))*(?:"""|$)|'(?:[^'\\]|\\[\S\s])*(?:'|$)|"(?:[^"\\]|\\[\S\s])*(?:"|$))/,q,"'\""]):a.multiLineStrings?m.push(["str",/^(?:'(?:[^'\\]|\\[\S\s])*(?:'|$)|"(?:[^"\\]|\\[\S\s])*(?:"|$)|`(?:[^\\`]|\\[\S\s])*(?:`|$))/,
q,"'\"`"]):m.push(["str",/^(?:'(?:[^\n\r'\\]|\\.)*(?:'|$)|"(?:[^\n\r"\\]|\\.)*(?:"|$))/,q,"\"'"]);a.verbatimStrings&&e.push(["str",/^@"(?:[^"]|"")*(?:"|$)/,q]);var h=a.hashComments;h&&(a.cStyleComments?(h>1?m.push(["com",/^#(?:##(?:[^#]|#(?!##))*(?:###|$)|.*)/,q,"#"]):m.push(["com",/^#(?:(?:define|elif|else|endif|error|ifdef|include|ifndef|line|pragma|undef|warning)\b|[^\n\r]*)/,q,"#"]),e.push(["str",/^<(?:(?:(?:\.\.\/)*|\/?)(?:[\w-]+(?:\/[\w-]+)+)?[\w-]+\.h|[a-z]\w*)>/,q])):m.push(["com",/^#[^\n\r]*/,
q,"#"]));a.cStyleComments&&(e.push(["com",/^\/\/[^\n\r]*/,q]),e.push(["com",/^\/\*[\S\s]*?(?:\*\/|$)/,q]));a.regexLiterals&&e.push(["lang-regex",/^(?:^^\.?|[!+-]|!=|!==|#|%|%=|&|&&|&&=|&=|\(|\*|\*=|\+=|,|-=|->|\/|\/=|:|::|;|<|<<|<<=|<=|=|==|===|>|>=|>>|>>=|>>>|>>>=|[?@[^]|\^=|\^\^|\^\^=|{|\||\|=|\|\||\|\|=|~|break|case|continue|delete|do|else|finally|instanceof|return|throw|try|typeof)\s*(\/(?=[^*/])(?:[^/[\\]|\\[\S\s]|\[(?:[^\\\]]|\\[\S\s])*(?:]|$))+\/)/]);(h=a.types)&&e.push(["typ",h]);a=(""+a.keywords).replace(/^ | $/g,
"");a.length&&e.push(["kwd",RegExp("^(?:"+a.replace(/[\s,]+/g,"|")+")\\b"),q]);m.push(["pln",/^\s+/,q," \r\n\t\xa0"]);e.push(["lit",/^@[$_a-z][\w$@]*/i,q],["typ",/^(?:[@_]?[A-Z]+[a-z][\w$@]*|\w+_t\b)/,q],["pln",/^[$_a-z][\w$@]*/i,q],["lit",/^(?:0x[\da-f]+|(?:\d(?:_\d+)*\d*(?:\.\d*)?|\.\d\+)(?:e[+-]?\d+)?)[a-z]*/i,q,"0123456789"],["pln",/^\\[\S\s]?/,q],["pun",/^.[^\s\w"-$'./@\\`]*/,q]);return x(m,e)}/**
 * Splits the content of a DOM element into individual lines and wraps them in an ordered list with line numbering.
 *
 * Moves all child nodes of the specified element into a single list item, then recursively processes these nodes to split text by newline characters. Handles BR elements by triggering line breaks and removing them from their parents. When the element's computed "white-space" style indicates preformatted text (i.e., begins with "pre"), text nodes are examined for newline delimiters and split accordingly. Each resulting line is wrapped in an <LI> element, and a class indicating the line number modulo 10 (e.g., "L0", "L1", ...) is added.
 *
 * If an optional starting line number is provided as an integer, the first line item is assigned a "value" attribute corresponding to that number.
 *
 * @param {HTMLElement} a - The container element whose child nodes will be segmented into numbered lines.
 * @param {number} [m] - Optional starting line number for the generated line numbers.
 *
 * @returns {void}
 *
 * @example
 * // Given a preformatted code block element:
 * // <pre id="code">Line1
 * // Line2
 * // Line3</pre>
 * const codeElement = document.getElementById('code');
 * D(codeElement, 1);
 * // The content of codeElement is transformed into a styled ordered list of lines with class "linenums".
 */
function D(a,m){function e(a){switch(a.nodeType){case 1:if(k.test(a.className))break;if("BR"===a.nodeName)h(a),
a.parentNode&&a.parentNode.removeChild(a);else for(a=a.firstChild;a;a=a.nextSibling)e(a);break;case 3:case 4:if(p){var b=a.nodeValue,d=b.match(t);if(d){var c=b.substring(0,d.index);a.nodeValue=c;(b=b.substring(d.index+d[0].length))&&a.parentNode.insertBefore(s.createTextNode(b),a.nextSibling);h(a);c||a.parentNode.removeChild(a)}}}}function h(a){function b(a,d){var e=d?a.cloneNode(!1):a,f=a.parentNode;if(f){var f=b(f,1),g=a.nextSibling;f.appendChild(e);for(var h=g;h;h=g)g=h.nextSibling,f.appendChild(h)}return e}
for(;!a.nextSibling;)if(a=a.parentNode,!a)return;for(var a=b(a.nextSibling,0),e;(e=a.parentNode)&&e.nodeType===1;)a=e;d.push(a)}var k=/(?:^|\s)nocode(?:\s|$)/,t=/\r\n?|\n/,s=a.ownerDocument,l;a.currentStyle?l=a.currentStyle.whiteSpace:window.getComputedStyle&&(l=s.defaultView.getComputedStyle(a,q).getPropertyValue("white-space"));var p=l&&"pre"===l.substring(0,3);for(l=s.createElement("LI");a.firstChild;)l.appendChild(a.firstChild);for(var d=[l],g=0;g<d.length;++g)e(d[g]);m===(m|0)&&d[0].setAttribute("value",
m);var r=s.createElement("OL");r.className="linenums";for(var n=Math.max(0,m-1|0)||0,g=0,z=d.length;g<z;++g)l=d[g],l.className="L"+(g+n)%10,l.firstChild||l.appendChild(s.createTextNode("\xa0")),r.appendChild(l);a.appendChild(r)}/**
 * Registers a language handler for multiple language identifiers.
 *
 * For each identifier in the provided array, assigns the given handler if no handler
 * is already registered. If a handler exists for an identifier, a warning is logged to
 * the console (when available) and the existing handler is not overridden.
 *
 * @param {Function} a - The language handler function to be registered.
 * @param {string[]} m - An array of language identifiers to associate with the handler.
 */
function k(a,m){for(var e=m.length;--e>=0;){var h=m[e];A.hasOwnProperty(h)?window.console&&console.warn("cannot override language handler %s",h):A[h]=a}}/**
 * Retrieves the syntax handler associated with the provided key, defaulting based on a heuristic if necessary.
 *
 * If the language key {@code a} is falsy or does not exist in the handlers' collection, a regex check is performed on the
 * string {@code m}. If {@code m} starts with optional whitespace followed by a "<" character, the default "markup"
 * handler is selected; otherwise, the default "code" handler is used.
 *
 * @param {string} a - The language key for the handler lookup. If invalid or not provided, a default is chosen.
 * @param {string} m - The code or markup string used to determine the default handler when {@code a} is absent.
 * @returns {*} The syntax handler corresponding to the determined language key.
 */
function C(a,m){if(!a||!A.hasOwnProperty(a))a=/^\s*</.test(m)?"default-markup":"default-code";return A[a]}/**
 * Consolidates token ranges and applies syntax highlighting by updating text nodes within the DOM.
 *
 * Processes token indices and text fragments from the provided state object. The function merges
 * adjacent token range pairs, removes redundancies, and wraps text portions in <span> elements with
 * corresponding CSS classes. It updates internal state properties and performs browser-specific fixes,
 * such as newline adjustments for Internet Explorer.
 *
 * @param {Object} state - The state object containing the highlighting process data.
 * @param {*} state.g - The language handler or configuration object used for token processing.
 * @param {*} state.h - The input element or node whose text content is to be processed.
 * @param {string} [state.a] - The code string to be highlighted, updated during processing.
 * @param {Array} [state.c] - Array holding DOM nodes or related data used to manage text fragments.
 * @param {number} [state.d] - A control variable for internal processing, initialized to 0.
 * @param {Array} state.e - Array of token information represented in pairs (e.g., index and CSS class).
 *
 * @example
 * const state = {
 *   g: languageHandler,  // Object with language-specific rules
 *   h: codeElement,       // DOM element containing the code snippet
 *   e: tokenArray         // Initial array with token indices and corresponding styles
 * };
 * E(state);
 * // The state object and related DOM nodes are modified so that the code snippet is highlighted.
 *
 * @remark
 * The function performs in-place consolidation of the token index array and uses chained loops to eliminate
 * redundant token ranges. For Internet Explorer, newline characters are replaced with carriage returns to maintain
 * text consistency.
 */
function E(a){var m=
a.g;try{var e=M(a.h),h=e.a;a.a=h;a.c=e.c;a.d=0;C(m,h)(a);var k=/\bMSIE\b/.test(navigator.userAgent),m=/\n/g,t=a.a,s=t.length,e=0,l=a.c,p=l.length,h=0,d=a.e,g=d.length,a=0;d[g]=s;var r,n;for(n=r=0;n<g;)d[n]!==d[n+2]?(d[r++]=d[n++],d[r++]=d[n++]):n+=2;g=r;for(n=r=0;n<g;){for(var z=d[n],f=d[n+1],b=n+2;b+2<=g&&d[b+1]===f;)b+=2;d[r++]=z;d[r++]=f;n=b}for(d.length=r;h<p;){var o=l[h+2]||s,c=d[a+2]||s,b=Math.min(o,c),i=l[h+1],j;if(i.nodeType!==1&&(j=t.substring(e,b))){k&&(j=j.replace(m,"\r"));i.nodeValue=
j;var u=i.ownerDocument,v=u.createElement("SPAN");v.className=d[a+1];var x=i.parentNode;x.replaceChild(v,i);v.appendChild(i);e<o&&(l[h+1]=i=u.createTextNode(t.substring(b,o)),x.insertBefore(i,v.nextSibling))}e=b;e>=o&&(h+=2);e>=c&&(a+=2)}}catch(w){"console"in window&&console.log(w&&w.stack?w.stack:w)}}var v=["break,continue,do,else,for,if,return,while"],w=[[v,"auto,case,char,const,default,double,enum,extern,float,goto,int,long,register,short,signed,sizeof,static,struct,switch,typedef,union,unsigned,void,volatile"],
"catch,class,delete,false,import,new,operator,private,protected,public,this,throw,true,try,typeof"],F=[w,"alignof,align_union,asm,axiom,bool,concept,concept_map,const_cast,constexpr,decltype,dynamic_cast,explicit,export,friend,inline,late_check,mutable,namespace,nullptr,reinterpret_cast,static_assert,static_cast,template,typeid,typename,using,virtual,where"],G=[w,"abstract,boolean,byte,extends,final,finally,implements,import,instanceof,null,native,package,strictfp,super,synchronized,throws,transient"],
H=[G,"as,base,by,checked,decimal,delegate,descending,dynamic,event,fixed,foreach,from,group,implicit,in,interface,internal,into,is,lock,object,out,override,orderby,params,partial,readonly,ref,sbyte,sealed,stackalloc,string,select,uint,ulong,unchecked,unsafe,ushort,var"],w=[w,"debugger,eval,export,function,get,null,set,undefined,var,with,Infinity,NaN"],I=[v,"and,as,assert,class,def,del,elif,except,exec,finally,from,global,import,in,is,lambda,nonlocal,not,or,pass,print,raise,try,with,yield,False,True,None"],
J=[v,"alias,and,begin,case,class,def,defined,elsif,end,ensure,false,in,module,next,nil,not,or,redo,rescue,retry,self,super,then,true,undef,unless,until,when,yield,BEGIN,END"],v=[v,"case,done,elif,esac,eval,fi,function,in,local,set,then,until"],K=/^(DIR|FILE|vector|(de|priority_)?queue|list|stack|(const_)?iterator|(multi)?(set|map)|bitset|u?(int|float)\d*)/,N=/\S/,O=u({keywords:[F,H,w,"caller,delete,die,do,dump,elsif,eval,exit,foreach,for,goto,if,import,last,local,my,next,no,our,print,package,redo,require,sub,undef,unless,until,use,wantarray,while,BEGIN,END"+
I,J,v],hashComments:!0,cStyleComments:!0,multiLineStrings:!0,regexLiterals:!0}),A={};k(O,["default-code"]);k(x([],[["pln",/^[^<?]+/],["dec",/^<!\w[^>]*(?:>|$)/],["com",/^<\!--[\S\s]*?(?:--\>|$)/],["lang-",/^<\?([\S\s]+?)(?:\?>|$)/],["lang-",/^<%([\S\s]+?)(?:%>|$)/],["pun",/^(?:<[%?]|[%?]>)/],["lang-",/^<xmp\b[^>]*>([\S\s]+?)<\/xmp\b[^>]*>/i],["lang-js",/^<script\b[^>]*>([\S\s]*?)(<\/script\b[^>]*>)/i],["lang-css",/^<style\b[^>]*>([\S\s]*?)(<\/style\b[^>]*>)/i],["lang-in.tag",/^(<\/?[a-z][^<>]*>)/i]]),
["default-markup","htm","html","mxml","xhtml","xml","xsl"]);k(x([["pln",/^\s+/,q," \t\r\n"],["atv",/^(?:"[^"]*"?|'[^']*'?)/,q,"\"'"]],[["tag",/^^<\/?[a-z](?:[\w-.:]*\w)?|\/?>$/i],["atn",/^(?!style[\s=]|on)[a-z](?:[\w:-]*\w)?/i],["lang-uq.val",/^=\s*([^\s"'>]*(?:[^\s"'/>]|\/(?=\s)))/],["pun",/^[/<->]+/],["lang-js",/^on\w+\s*=\s*"([^"]+)"/i],["lang-js",/^on\w+\s*=\s*'([^']+)'/i],["lang-js",/^on\w+\s*=\s*([^\s"'>]+)/i],["lang-css",/^style\s*=\s*"([^"]+)"/i],["lang-css",/^style\s*=\s*'([^']+)'/i],["lang-css",
/^style\s*=\s*([^\s"'>]+)/i]]),["in.tag"]);k(x([],[["atv",/^[\S\s]+/]]),["uq.val"]);k(u({keywords:F,hashComments:!0,cStyleComments:!0,types:K}),["c","cc","cpp","cxx","cyc","m"]);k(u({keywords:"null,true,false"}),["json"]);k(u({keywords:H,hashComments:!0,cStyleComments:!0,verbatimStrings:!0,types:K}),["cs"]);k(u({keywords:G,cStyleComments:!0}),["java"]);k(u({keywords:v,hashComments:!0,multiLineStrings:!0}),["bsh","csh","sh"]);k(u({keywords:I,hashComments:!0,multiLineStrings:!0,tripleQuotedStrings:!0}),
["cv","py"]);k(u({keywords:"caller,delete,die,do,dump,elsif,eval,exit,foreach,for,goto,if,import,last,local,my,next,no,our,print,package,redo,require,sub,undef,unless,until,use,wantarray,while,BEGIN,END",hashComments:!0,multiLineStrings:!0,regexLiterals:!0}),["perl","pl","pm"]);k(u({keywords:J,hashComments:!0,multiLineStrings:!0,regexLiterals:!0}),["rb"]);k(u({keywords:w,cStyleComments:!0,regexLiterals:!0}),["js"]);k(u({keywords:"all,and,by,catch,class,else,extends,false,finally,for,if,in,is,isnt,loop,new,no,not,null,of,off,on,or,return,super,then,true,try,unless,until,when,while,yes",
hashComments:3,cStyleComments:!0,multilineStrings:!0,tripleQuotedStrings:!0,regexLiterals:!0}),["coffee"]);k(x([],[["str",/^[\S\s]+/]]),["regex"]);window.prettyPrintOne=function(a,m,e){var h=document.createElement("PRE");h.innerHTML=a;e&&D(h,e);E({g:m,i:e,h:h});return h.innerHTML};window.prettyPrint=function(a){/**
 * Processes a batch of DOM nodes with the "prettyprint" class for syntax highlighting.
 *
 * Iterates over a global collection of nodes and applies highlighting logic within a time-sliced loop.
 * When the global flag PR_SHOULD_USE_CONTINUATION is true, processing is limited to a 250ms slice per iteration
 * (using l.now() for timing) to maintain UI responsiveness. For each node containing "prettyprint":
 * - Extracts highlighting options via a regex applied to the node's class name.
 * - Traverses child nodes to detect a nested CODE element, adjusting the highlighting options if found.
 * - Checks ancestor nodes to avoid reprocessing elements already within a highlighted container (e.g., PRE, CODE, XMP).
 * - Parses any "linenums" specification from the class name, applying line numbering if defined.
 * - Invokes external functions D and E to apply the calculated formatting.
 *
 * Global side effects:
 * - Relies on and updates global variables such as h (nodes array), p (current index), a (completion callback),
 *   and shared configuration flags.
 *
 * No parameters or return value.
 */
function m(){for(var e=window.PR_SHOULD_USE_CONTINUATION?l.now()+250:Infinity;p<h.length&&l.now()<e;p++){var n=h[p],k=n.className;if(k.indexOf("prettyprint")>=0){var k=k.match(g),f,b;if(b=
!k){b=n;for(var o=void 0,c=b.firstChild;c;c=c.nextSibling)var i=c.nodeType,o=i===1?o?b:c:i===3?N.test(c.nodeValue)?b:o:o;b=(f=o===b?void 0:o)&&"CODE"===f.tagName}b&&(k=f.className.match(g));k&&(k=k[1]);b=!1;for(o=n.parentNode;o;o=o.parentNode)if((o.tagName==="pre"||o.tagName==="code"||o.tagName==="xmp")&&o.className&&o.className.indexOf("prettyprint")>=0){b=!0;break}b||((b=(b=n.className.match(/\blinenums\b(?::(\d+))?/))?b[1]&&b[1].length?+b[1]:!0:!1)&&D(n,b),d={g:k,h:n,i:b},E(d))}}p<h.length?setTimeout(m,
250):a&&a()}for(var e=[document.getElementsByTagName("pre"),document.getElementsByTagName("code"),document.getElementsByTagName("xmp")],h=[],k=0;k<e.length;++k)for(var t=0,s=e[k].length;t<s;++t)h.push(e[k][t]);var e=q,l=Date;l.now||(l={now:function(){return+new Date}});var p=0,d,g=/\blang(?:uage)?-([\w.]+)(?!\S)/;m()};window.PR={createSimpleLexer:x,registerLangHandler:k,sourceDecorator:u,PR_ATTRIB_NAME:"atn",PR_ATTRIB_VALUE:"atv",PR_COMMENT:"com",PR_DECLARATION:"dec",PR_KEYWORD:"kwd",PR_LITERAL:"lit",
PR_NOCODE:"nocode",PR_PLAIN:"pln",PR_PUNCTUATION:"pun",PR_SOURCE:"src",PR_STRING:"str",PR_TAG:"tag",PR_TYPE:"typ"}})();

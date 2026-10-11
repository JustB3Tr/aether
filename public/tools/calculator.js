// A small expression grammar, never JavaScript evaluation.
export function calculate(source) {
  if(typeof source!=='string'||source.length>300)throw Error('Use an expression under 300 characters.');
  const text=source.replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-').replace(/π/g,'pi');
  const tokens=[];let offset=0;
  while(offset<text.length){if(/\s/.test(text[offset])){offset++;continue;}const match=text.slice(offset).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|^(?:pi|sqrt|abs|sin|cos|tan|log|ln|e)\b|^[()+\-*/^%]/i);if(!match)throw Error('Use numbers, operators, pi, e, or a supported function.');tokens.push(match[0].toLowerCase());offset+=match[0].length;}
  let i=0;const functions={sqrt:Math.sqrt,abs:Math.abs,sin:Math.sin,cos:Math.cos,tan:Math.tan,log:Math.log10,ln:Math.log};
  function primary(){const t=tokens[i++];if(t==='('){const n=sum();if(tokens[i++]!==')')throw Error('Close each parenthesis.');return n;}if(t==='pi')return Math.PI;if(t==='e')return Math.E;if(Object.hasOwn(functions,t)){if(tokens[i++]!=='(')throw Error('Functions need parentheses.');const n=sum();if(tokens[i++]!==')')throw Error('Close each function.');return functions[t](n);}if(t!==undefined&&/^(\d|\.)/.test(t))return Number(t);throw Error('A number or function is missing.');}
  function power(){let n=primary();while(tokens[i]==='%'){i++;n/=100;}if(tokens[i]==='^'){i++;n=n**unary();}return n;}
  function unary(){if(tokens[i]==='+'){i++;return unary();}if(tokens[i]==='-'){i++;return -unary();}return power();}
  function product(){let n=unary();while(tokens[i]==='*'||tokens[i]==='/'){const op=tokens[i++],v=unary();n=op==='*'?n*v:n/v;}return n;}
  function sum(){let n=product();while(tokens[i]==='+'||tokens[i]==='-'){const op=tokens[i++],v=product();n=op==='+'?n+v:n-v;}return n;}
  const result=sum();if(i!==tokens.length)throw Error('Check the operators between numbers.');if(!Number.isFinite(result))throw Error('That expression has no finite real result.');return Number(result.toPrecision(12));
}
export const units={Length:{m:1,km:1000,cm:.01,mm:.001,in:.0254,ft:.3048,yd:.9144,mi:1609.344},Mass:{kg:1,g:.001,lb:.45359237,oz:.028349523125},Speed:{'m/s':1,'km/h':1/3.6,mph:.44704},Temperature:{'°C':1,'°F':1,K:1}};
export function convert(value,kind,from,to){if(!Number.isFinite(value)||!units[kind]||!Object.hasOwn(units[kind],from)||!Object.hasOwn(units[kind],to))throw Error('Choose a valid value and units.');let result;if(kind==='Temperature'){const c=from==='°F'?(value-32)*5/9:from==='K'?value-273.15:value;if(c< -273.15)throw Error('Temperature cannot be below absolute zero.');result=to==='°F'?c*9/5+32:to==='K'?c+273.15:c;}else result=value*units[kind][from]/units[kind][to];if(!Number.isFinite(result))throw Error('The converted value is too large.');return Number(result.toPrecision(12));}

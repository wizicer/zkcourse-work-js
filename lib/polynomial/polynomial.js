
/**
 * @license Polynomial.js v1.4.5 13/12/2017
 *
 * Copyright (c) 2017, Robert Eisele (robert@xarg.org)
 * Dual licensed under the MIT or GPL Version 2 licenses.
 **/

(function(root) {

    "use strict";
  
    /**
     * The actual field selected
     * 
     * @type Object
     */
    var FIELD = {// Run in R
      "add": function(a, b) {
        return a + b;
      },
      "sub": function(a, b) {
        return a - b;
      },
      "neg": function(a) {
        return -a;
      },
      "mul": function(a, b) {
        return a * b;
      },
      "div": function(a, b) {
        if (b === 0) {
          throw "DIV/0";
        }
        return a / b;
      },
      "parse": function(x) {
        return parseFloat(x);
      },
      "empty": function(x) {
        return !x; //undefined === x || 0 === x;
      },
      "pow": function(a, b) {
        return Math.pow(a, b);
      },
      "equals": function(a, b) {
        return a === b;
      }
    };
  
    /**
     * Save the original field for changes
     * 
     * @type Object
     */
    var ORIG_FIELD = FIELD;
  
    /**
     * The Fraction callback
     * 
     * @type Function
     */
    var Fraction;
  
    /**
     * The Complex callback
     * 
     * @type Function
     */
    var Complex;
  
    /**
     * The Quaternion callback
     * 
     * @type Function
     */
    var Quaternion;
  
    var STR_REGEXP = /([+-]?)(?:([^+x-]+)?(?:x(?:\^([\d\/]+))?)|([^+x-]+))/g;
  
    /**
     * The constructor function
     * 
     * @constructor
     * @param {String|Object|number} x The init polynomial
     */
    function Polynomial(x) {
  
      if (!(this instanceof Polynomial)) {
        return new Polynomial(x);
      }
      this['coeff'] = parse(x);
    }
  
    // Trace poly div steps
    Polynomial['trace'] = null;
  
    /**
     * Calculates the modular inverse
     * 
     * @param {number} z
     * @param {number} n
     * @returns {number}
     */
    var modinv = function(z, n) {
  
      /**
       *    z * s + n * t = 1 
       * => z * s mod n = 1
       * => z^-1 = s mod n
       */
      var tmp = egcd(z, n);
      if (tmp[0] !== 1) {
        throw "DIV/-";
      }
      return tmp[1];
    };
  
    /**
     * Calculates the gcd
     * 
     * @param {number} a
     * @param {number} b
     * @returns {number}
     */
    function gcd(a, b) {
      var t;
      while (b) {
        t = a;
        a = b;
        b = t % b;
      }
      return Math.abs(a);
    }
  
    function clone(x) {
  
      var res = {};
      for (var i in x) {
        res[i] = x[i];
      }
      return res;
    }
  
    /**
     * Calculates the extended gcd
     * 
     * @param {number} a
     * @param {number} b
     * @returns {Array}
     */
    var egcd = function(a, b) {
  
      // gcd = a * s  +  b * t
  
      var s = 0, t = 1, u = 1, v = 0;
      while (a !== 0) {
  
        var q = b / a | 0, r = b % a;
        var m = s - u * q, n = t - v * q;
  
        b = a;
        a = r;
        s = u;
        t = v;
        u = m;
        v = n;
      }
      return [b /* gcd*/, s, t];
    };
  
    /**
     * Calculates the extended gcd in bigint
     * 
     * @param {number} a
     * @param {number} b
     * @returns {Array}
     */
    var egcd_bigint = function(a, b) {
  
      // gcd = a * s  +  b * t
  
      var s = 0n, t = 1n, u = 1n, v = 0n;
      while (a !== 0n) {
  
        var q = b / a, r = b % a;
        var m = s - u * q, n = t - v * q;
  
        b = a;
        a = r;
        s = u;
        t = v;
        u = m;
        v = n;
      }
      return [b /* gcd*/, s, t];
    };
  
    /**
     * Calculates the modular inverse in bigint
     * 
     * @param {number} z
     * @param {number} n
     * @returns {number}
     */
    var modinv_bigint = function(z, n) {
  
      /**
       *    z * s + n * t = 1 
       * => z * s mod n = 1
       * => z^-1 = s mod n
       */
      var tmp = egcd_bigint(z, n);
      if (tmp[0] !== 1n) {
        throw "DIV/-";
      }
      return tmp[1];
    };

    function gcd(a, b) {
      while (b !== 0n) {
          const temp = b;
          b = a % b;
          a = temp;
      }
      return a;
  }
  
  // Extended Euclidean algorithm to find the modular inverse
  function modInverse(a, p) {
      if (gcd(a, p) !== 1n) {
          throw new Error("Inverse does not exist");
      }
      
      let [old_r, r] = [a, p];
      let [old_s, s] = [1n, 0n];
      let [old_t, t] = [0n, 1n];
      
      while (r !== 0n) {
          const quotient = old_r / r;
          [old_r, r] = [r, old_r - quotient * r];
          [old_s, s] = [s, old_s - quotient * s];
          [old_t, t] = [t, old_t - quotient * t];
      }
      
      // Make sure the result is positive
      return (old_s + p) % p;
  }
  
    /**
     * Calculates the mathematical modulo
     * 
     * @param {number} n
     * @param {number} m 
     * @returns {number}
     */
    var mod = function(n, m) {
  
      return (n % m + m) % m;
    };
  
    /**
     * Calculates the factorial n! / (n - k)!
     * 
     * @param {number} n
     * @param {number} k
     * @returns {number}
     */
    var factorial = function(n, k) {
  
      var p = 1;
      for (k = n - k; k < n; n--) {
        p *= n;
      }
      return p;
    };
  
    /**
     * The public coefficient object
     * 
     * @type {Object}
     */
    Polynomial.prototype['coeff'] = {};
  
    /**
     * Combines the keys of two objects
     * 
     * @param {Object} a
     * @param {Object} b
     * @returns {Object}
     */
    function keyUnion(a, b) {
  
      var k = {};
      for (var i in a) {
        k[i] = 1;
      }
      for (var i in b) {
        k[i] = 1;
      }
      return k;
    }
  
    /**
     * Gets the degree of the actual polynomial
     * 
     * @param {Object} x
     * @returns {number}
     */
    function degree(x) {
  
      var i = -Infinity;
  
      for (var k in x) {
        if (!FIELD['empty'](x[k]))
          i = Math.max(k, i);
      }
      return i;
    }
  
    /**
     * Helper function for division
     * 
     * @param {Object} x The numerator coefficients
     * @param {Object} y The denominator coefficients
     * @returns {Object}
     */
    var div = function(x, y) {
  
      var r = {};
  
      var i = degree(x);
      var j = degree(y);
      var trace = [];
  
      while (i >= j) {
  
        var tmp = r[i - j] = FIELD['div'](x[i] || 0, y[j] || 0);
  
        for (var k in y) {
          x[+k + i - j] = FIELD['sub'](x[+k + i - j] || 0, FIELD['mul'](y[k] || 0, tmp));
        }
  
        if (Polynomial['trace'] !== null) {
  
          var tr = {};
          for (var k in y) {
            tr[+k + i - j] = FIELD['mul'](y[k] || 0, tmp);
          }
          trace.push(new Polynomial(tr));
        }
  
        i = degree(x);
      }
  
      // Add rest
      if (Polynomial['trace'] !== null) {
        trace.push(new Polynomial(x));
        Polynomial['trace'] = trace;
      }
      return r;
    };
  
    function parseExp(sgn, exp) {
  
      exp = String(exp).match(/[^*/]+|[*/]/g);
  
      var num = FIELD['parse'](sgn + exp[0]);
  
      for (var i = 1; i < exp.length; i += 2) {
  
        if (exp[i] === '*') {
          num = FIELD['mul'](num, FIELD['parse'](exp[i + 1] || 1));
        } else if (exp[i] === '/') {
          num = FIELD['div'](num, FIELD['parse'](exp[i + 1] || 1));
        }
      }
      return num;
    }
  
    /**
     * Parses the actual number
     * 
     * @param {String|Object|null|number} x The polynomial to be parsed
     * @returns {Object}
     */
    var parse = function(x) {
  
      var ret = {};
  
      if (x === null || x === undefined) {
        x = 0;
      }
  
      switch (typeof x) {
  
        case "object":
  
          if (x['coeff']) {
            x = x['coeff'];
          }
  
          if (Fraction && x instanceof Fraction || Complex && x instanceof Complex || Quaternion && x instanceof Quaternion) {
            ret[0] = x;
          } else
            // Handles Arrays the same way
            for (var i in x) {
  
              if (!FIELD['empty'](x[i])) {
                ret[i] = FIELD['parse'](x[i]);
              }
            }
          return ret;
  
        case  "number":
          return {'0': FIELD['parse'](x)};
  
        case  "bigint":
          return {'0': FIELD['parse'](x)};
  
        case "string":
  
          var tmp;
  
          while (null !== (tmp = STR_REGEXP['exec'](x))) {
  
            var num = 1;
            var exp = 1;
  
            if (tmp[4] !== undefined) {
              num = tmp[4];
              exp = 0;
            } else if (tmp[2] !== undefined) {
              num = tmp[2];
            }
  
            num = parseExp(tmp[1], num);
  
            // Parse exponent
            if (tmp[3] !== undefined) {
              exp = parseInt(tmp[3], 10);
            }
  
            if (ret[exp] === undefined) {
              ret[exp] = num;
            } else {
              ret[exp] = FIELD['add'](ret[exp], num);
            }
          }
          return ret;
      }
      throw "Invalid Param";
    };
  
    /**
     * Calculates the gcd of two polynomials
     * 
     * @param {String|Object} x The denominator polynomial
     * @returns {Polynomial}
     */
    Polynomial.prototype['gcd'] = function(x) {
  
      var a = clone(this['coeff']);
      var b = parse(x);
  
      var max;
  
      while (!isNull(b)) {
  
        var r = clone(a);
  
        div(r, b);
  
        a = b;
        b = r;
      }
  
      max = lc(a);
  
      return new Polynomial(monic(a, max));
    };
  
    /**
     * Negate all coefficients of the polynomial
     * 
     * @returns {Polynomial}
     */
    Polynomial.prototype['neg'] = function() {
  
      var ret = {};
      var poly = this['coeff'];
  
      for (var i in poly) {
        ret[i] = FIELD['mul'](poly[i], -1);
      }
      return new Polynomial(ret);
    };
  
    /**
     * Return the 'reciprocal polynomial', where the coefficients
     * appear in opposite order; i.e. a[i] -> a[n-i].
     * See e.g. https://en.wikipedia.org/wiki/Reciprocal_polynomial
     *
     * @returns {Polynomial}
     */
    Polynomial.prototype['reciprocal'] = function() {
  
      var ret = {};
      var poly = this['coeff'];
      var n = degree(poly);
  
      for (var i in poly) {
        ret[n - i] = poly[i];
      }
      return new Polynomial(ret);
    };
  
    /**
     * Numerically evaluate the polynomial at a specific point x by
     * using Horner's method.
     * See e.g. https://en.wikipedia.org/wiki/Horner%27s_method
     *
     * @param {number} x The point where to evaluate this polynomial
     * @returns {number} The value P(x)
     */
    Polynomial.prototype['eval'] = function(x) {
  
      var poly = this['coeff'];
      var n = degree(poly);
  
      if (n < 0) {
        return 0;
      }
  
      var ret = poly[n];
  
      for (var i = n - 1; i >= 0; i--) {
        ret = FIELD['mul'](ret, x);
        if (!FIELD['empty'](poly[i])) {
          ret = FIELD['add'](ret, poly[i]);
        }
      }
      return ret;
    };
  
    function lc(poly) {
  
      var max = null;
  
      for (var i in poly) {
  
        if (!FIELD['empty'](poly[i])) {
  
          if (max === null || +max < +i) {
            max = i;
          }
        }
      }
      return max;
    }
  
    function monic(a, max) {
  
      if (max !== null) {
  
        for (var i in a) {
          a[i] = FIELD['div'](a[i], a[max]);
        }
      }
      return a;
    }
  
    /**
     * Gets the leading coefficient
     * 
     * @returns {Polynomial}
     */
    Polynomial.prototype['lc'] = function() {
  
      var max = lc(this['coeff']);
  
      return this['coeff'][max];
    };
  
    /**
     * Gets the leading monomial
     * 
     * @returns {Polynomial}
     */
    Polynomial.prototype['lm'] = function() {
  
      var max = lc(this['coeff']);
  
      var res = {};
  
      res[max] = this['coeff'][max];
      return new Polynomial(res);
    };
  
    /**
     * Divide all coefficients of f by lc(f)
     * 
     * @returns {Polynomial}
     */
    Polynomial.prototype['monic'] = function() {
  
      return new Polynomial(monic(clone(this['coeff']), lc(this['coeff'])));
    };
  
    /**
     * Calculates the sum of two polynomials
     * 
     * @param {String|Object} x The summand polynomial
     * @returns {Polynomial}
     */
    Polynomial.prototype['add'] = function(x) {
  
      var para = parse(x);
  
      var ret = {};
      var poly = this['coeff'];
  
      var keys = keyUnion(para, poly);
  
      for (var i in keys) {
        ret[i] = FIELD['add'](poly[i] || 0, para[i] || 0);
      }
      return new Polynomial(ret);
    };
  
    /**
     * Calculates the difference of two polynomials
     * 
     * @param {String|Object} x The subtrahend polynomial
     * @returns {Polynomial}
     */
    Polynomial.prototype['sub'] = function(x) {
  
      var para = parse(x);
  
      var ret = {};
      var poly = this['coeff'];
  
      var keys = keyUnion(para, poly);
  
      for (var i in keys) {
        ret[i] = FIELD['sub'](poly[i] || 0, para[i] || 0);
      }
      return new Polynomial(ret);
    };
  
    /**
     * Calculates the product of two polynomials
     * 
     * @param {String|Object} x The minuend polynomial
     * @returns {Polynomial}
     */
    Polynomial.prototype['mul'] = function(x) {
  
      var para = parse(x);
  
      var ret = {};
      var poly = this['coeff'];
  
      for (var i in para) {
  
        i = +i;
  
        for (var j in poly) {
  
          j = +j;
  
          ret[i + j] = FIELD['add'](ret[i + j] || 0, FIELD['mul'](para[i] || 0, poly[j] || 0));
        }
      }
      return new Polynomial(ret);
    };
  
    /**
     * Calculates the product of the two parameters and adds it to the current number (linear combination)
     * 
     * @param {String|Object} x The first factor polynomial
     * @param {String|Object} y The second factor polynomial
     * @returns {Polynomial}
     */
    Polynomial.prototype['addmul'] = function(x, y) {
  
      var _x = parse(x);
      var _y = parse(y);
  
      var res = {};
      for (var i in _x) {
  
        i = +i;
  
        for (var j in _y) {
          j = +j;
  
          res[i + j] = FIELD['add'](res[i + j] || 0, FIELD['mul'](_x[i] || 0, _y[j] || 0));
        }
      }
      return this['add'](res);
    };
  
    /**
     * Calculates the quotient of two polynomials
     * 
     * @param {String|Object} x The denominator polynomial
     * @returns {Polynomial}
     */
    Polynomial.prototype['div'] = function(x) {
  
      return new Polynomial(div(clone(this['coeff']), parse(x)));
    };
  
    /**
     * Calculates the pow of a polynomial to the exponent e
     * 
     * @returns {Polynomial}
     */
    Polynomial.prototype['pow'] = function(e) {
  
      if (isNaN(e) || e < 0 || e % 1) { // Only integer exponents
        throw "Invalid";
      }
  
      var res = new Polynomial(1);
      var tmp = this;
  
      while (e > 0) {
  
        if (e & 1) {
          res = res['mul'](tmp);
        }
        tmp = tmp['mul'](tmp);
        e >>= 1;
      }
      return res;
    };
  
    /**
     * Calculates the modulo of a polynomial to another
     * 
     * @param {String|Object} x The second poly
     * @returns {Polynomial}
     */
    Polynomial.prototype['mod'] = function(x) {
  
      var mod = clone(this['coeff']);
  
      div(mod, parse(x));
  
      return new Polynomial(mod);
    };
  
    /**
     * Calculates the nth derivative of the polynomial
     * 
     * @param {number} n The nth derivative
     * @returns {Polynomial}
     */
    Polynomial.prototype['derive'] = function(n) {
  
      if (n === undefined) {
        n = 1;
      } else if (n < 0) {
        return null;
      }
  
      var poly = this['coeff'];
      var ret = {};
  
      for (var i in poly) {
  
        if (+i >= n)
          ret[i - n] = FIELD['mul'](poly[i] || 0, factorial(+i, n));
      }
      return new Polynomial(ret);
    };
  
    /**
     * Calculates the nth integral of the polynomial
     * 
     * @param {number} n The nth integral
     * @returns {Polynomial}
     */
    Polynomial.prototype['integrate'] = function(n) {
  
      if (n === undefined) {
        n = 1;
      } else if (n < 0) {
        return null;
      }
  
      var poly = this['coeff'];
      var ret = {};
  
      for (var i in poly) {
        ret[+i + n] = FIELD['div'](poly[i] || 0, factorial(+i + n, n));
      }
      return new Polynomial(ret);
    };
  
    /**
     * (Deprecated) alias for 'eval'
     */
    Polynomial.prototype['result'] = Polynomial.prototype['eval'];
  
    /**
     * Form a (monic) polynomial out of an array of roots
     *
     * @param {Array<number>} roots - Array of roots
     * @returns {Polynomial} The monic polynomial with those roots
     */
    Polynomial['fromRoots'] = function(roots) {
  
      var n = roots.length;
  
      var zero = FIELD['parse'](0);
  
      var nonZeroRoots = roots.filter(root => (!(FIELD['equals'](root, zero))));
      var numZeros = n - nonZeroRoots.length;
  
      // First we construct the depressed polynomial with a recursive
      // strategy (this minimizes the number of multiplications)
      var pOne = new Polynomial(FIELD['parse'](1));
  
      function productHelper(r) {
        switch (r.length) {
          case 0:
            return pOne;
          case 1:
            return new Polynomial([FIELD['mul'](r[0], -1), 1]);
          default: // recurse
            var nLeft = Math.floor(r.length / 2);
            var left = r.slice(0, nLeft);
            var right = r.slice(nLeft, r.length);
            return productHelper(left).mul(productHelper(right));
        }
      }
  
      var dep = productHelper(nonZeroRoots);
  
      // Now raise the order by including numZeros zeros
      var dcoeff = dep['coeff'];
      var coeff = {};
  
      for (var i in dcoeff) {
        coeff[numZeros + parseInt(i, 10)] = dcoeff[i];
      }
  
      return new Polynomial(coeff);
    };
  
    function isNull(r) {
  
      return degree(r) < 0;
    }
  
    /**
     * Helper method to stringify
     * 
     * @param {string} fn the callback name
     * @returns {Function}
     */
    var toString = function(fn) {
  
      /**
       * The actual to string function 
       * 
       * @returns {string|null}
       */
      var Str = function() {
  
        var poly = this['coeff'];
  
        var keys = [];
        for (var i in poly) {
          keys.push(+i);
        }
  
        if (keys.length === 0)
          return "0";
  
        keys.sort(function(a, b) {
          return a - b;
        });
  
        var str = "";
        for (var k = keys.length; k--; ) {
  
          var i = keys[k];
  
          var cur = poly[i];
  
          var val = cur;
  
          if (val === null || val === undefined)
            continue;
  
          if (Complex && val instanceof Complex) {
  
            // Add real part
            if (val['re'] !== 0) {
  
              if (str !== "" && val['re'] > 0) {
                str += "+";
              }
  
              if (val['re'] === -1 && i !== 0) {
                str += "-";
              } else if (val['re'] !== 1 || i === 0) {
                str += val['re'];
              }
  
              // Add exponent if necessary, no DRY, let's feed gzip
              if (i === 1)
                str += "x";
              else if (i !== 0)
                str += "x^" + i;
            }
  
            // Add imaginary part
            if (val['im'] !== 0) {
  
              if (str !== "" && val['im'] > 0) {
                str += "+";
              }
  
              if (val['im'] === -1) {
                str += "-";
              } else if (val['im'] !== 1) {
                str += val['im'];
              }
  
              str += "i";
  
              // Add exponent if necessary, no DRY, let's feed gzip
              if (i === 1)
                str += "x";
              else if (i !== 0)
                str += "x^" + i;
            }
  
          } else {
  
            val = val.valueOf();
  
            // Skip if it's zero
            if (val === 0)
              continue;
  
            // Separate by +
            if (str !== "" && val > 0) {
              str += "+";
            }
  
            if (val === -1 && i !== 0)
              str += "-";
            else
  
            // Add number if it's not a "1" or the first position
            if (val !== 1 || i === 0)
              str += cur[fn] ? cur[fn]() : cur['toString']();
  
            // Add exponent if necessary, no DRY, let's feed gzip
            if (i === 1)
              str += "x";
            else if (i !== 0)
              str += "x^" + i;
          }
        }
  
        if (str === "")
          return cur[fn] ? cur[fn]() : cur['toString']();
  
        return str;
      };
      return Str;
    };
  
    /**
     * Formats the polynomial as a string
     * 
     * @returns {string} The polynomial string
     */
    Polynomial.prototype['toString'] = toString("toString");
  
    /**
     * Formats the polynomial as a latex representation
     * 
     * @returns {string} The polynomial latex string
     */
    Polynomial.prototype['toLatex'] = toString("toLatex");
  
    /**
     * Returns the actual polynomial in horner scheme
     * 
     * @returns {string}
     */
    Polynomial.prototype['toHorner'] = function() {
  
      var poly = this['coeff'];
      var keys = [];
      for (var i in poly) {
        if (!FIELD.empty(poly[i]))
          keys.push(+i);
      }
  
      if (keys.length === 0)
        return "0";
  
      keys.sort(function(a, b) {
        return a - b;
      });
  
      // TODO: DRY, Combine with toString function
      function valToString(val, hasSign) {
  
        var str = "";
  
        if (Complex && val instanceof Complex) {
  
          if (val['im'] === 0) {
  
            if (val['re'] > 0 && hasSign) {
              str += "+";
            }
            str += val['re'];
  
          } else if (val['re'] === 0) {
  
            if (val['im'] === -1) {
              str += "-";
            } else if (val['im'] !== 1) {
  
              if (val['im'] > 0 && hasSign) {
                str += "+";
              }
              str += val['im'];
            } else {
              if (val['im'] > 0 && hasSign) {
                str += "+";
              }
            }
            str += "i";
  
          } else {
  
            if (hasSign) {
              str += "+";
            }
  
            str += "(";
            str += val.toString();
            str += ")";
          }
  
          return str;
  
        } else {
  
          if (val > 0 && hasSign) {
            str += "+";
          }
          str += val.toString();
        }
        return str;
      }
  
      function rec(keys, pos) {
  
        var ndx = keys.length - pos - 1;
        var exp = keys[ndx] - (keys[ndx - 1] || 0);
        var str1 = "";
        var str2 = "";
  
        if (exp > 0) {
          str1 = "x";
  
          if (exp > 1) {
            str1 += "^" + exp;
          }
        }
  
        if (ndx > 0)
          str1 += valToString(poly[keys[ndx - 1]], true);
  
        if (pos === 0) {
          return valToString(poly[keys[ndx]], false) + str1;
        }
  
        if (ndx >= 0 && keys[ndx])
          str2 += "(";
  
        str2 += rec(keys, pos - 1);
  
        if (ndx >= 0 && keys[ndx])
          str2 += ")";
  
        str2 += str1;
  
        return str2;
      }
      return rec(keys, keys.length - 1);
    };
  
    /**
     * Helper method to get array of coefficients
     * 
     * @returns {Function}
     */
    Polynomial.prototype['toArray'] = function() {
  
      var poly = this['coeff'];
      function objectToArray(obj) {
        const keys = Object.keys(obj).sort((a, b) => parseInt(a) - parseInt(b));
        const result = [];
        keys.forEach(key => {
            const value = obj[key];
            const filledValue = value !== undefined && value !== null ? value : 0;
            result.push(filledValue);
        });
        
        return result;
      }
      return objectToArray(poly);
    };
  
    /**
     * to lagrange polynomial interpolation L(x)
     * 
     * @param {[number, number][]} points interpolation points like [[1,2],[2,3],[3,4]]
     * @returns {Polynomial}
     */
    Polynomial['interpolate'] = function(points, progressCallback) {
        let neg = FIELD["neg"];
        let div = FIELD["div"];
        let mul = FIELD["mul"];
        let sub = FIELD["sub"];
        let add = FIELD["add"];
        let parse = FIELD["parse"];
      const n = points.length;
      const weights = Array(n).fill(parse(1));

      for (let j = 0; j < n; j++) {
          for (let k = 0; k < n; k++) {
              if (j !== k) {
                  weights[j] = mul(weights[j], sub(points[j][0], points[k][0]));
              }
          }
      }
      
      // console.time("interpolate-weights");
      let multiplyPoly = (poly1, poly2) => {
        const result = Array(poly1.length + poly2.length - 1).fill(parse(0));
        for (let i = 0; i < poly1.length; i++) {
          for (let j = 0; j < poly2.length; j++) {
            result[i + j] = add(result[i + j], mul(poly1[i], poly2[j]));
          }
        }
        // console.log("MUL:", poly1, "X", poly2, "=", result);
        return result;
      };
      // console.timeEnd("interpolate-weights");

      // console.time("interpolate-multiplyPoly");
      let polynomialCoefficients = Array(n).fill(parse(0));
      for (let j = 0; j < n; j++) {
          const xj = points[j][0];
          const yj = points[j][1];
          let term = [div(yj, weights[j])];

          for (let m = 0; m < n; m++) {
              if (m !== j) {
                const xm = points[m][0];
                  // term = multiplyPoly(term, [neg(mul(xj, neg(points[m][0] - xj))), neg(points[m][0] - xj)]);
                  term = multiplyPoly(term, [neg(xm), parse(1)]);
              }
          }

          for (let k = 0; k < term.length; k++) {
              polynomialCoefficients[k] = add(polynomialCoefficients[k], term[k]);
          }
          progressCallback && progressCallback(j , n);
      }
      // console.timeEnd("interpolate-multiplyPoly");

      return new Polynomial(polynomialCoefficients);




      // const n = points.length;
      // // let coefficients = Array(n).fill(0);
      // let final = new Polynomial(Array(n).fill(0));

      // for (let i = 0; i < n; i++) {
      //     let L_i = new Polynomial([1]);

      //     for (let j = 0; j < n; j++) {
      //         if (i !== j) {
      //             const L_j = FIELD['div'](new Polynomial( [1, -points[j][0]]), points[i][0] - points[j][0]);
      //             L_i = FIELD['mul'](L_i, L_j);
      //         }
      //     }

      //     let t = FIELD['mul'](L_i, points[i][1]);
      //     final = FIELD['add'](final, t);
      // }

      // return final;

      // https://stackoverflow.com/a/61265513
      const xPoints = points.map(([x, _]) => x);
      const yPoints = points.map(([_, y]) => y);
      const coefficients = xPoints.map((_) => 0);

      for (let m = 0; m < xPoints.length; m++) {
        const newCoefficients = xPoints.map((_) => 0);

        let neg = FIELD["neg"];
        let div = FIELD["div"];
        let mul = FIELD["mul"];
        let sub = FIELD["sub"];
        let add = FIELD["add"];
        if (m > 0) {
          newCoefficients[0] = div(neg(xPoints[0]), sub(xPoints[m], xPoints[0]));
          newCoefficients[1] = div(1, sub(xPoints[m], xPoints[0]));
        } else {
          newCoefficients[0] = div(neg(xPoints[1]), sub(xPoints[m], xPoints[1]));
          newCoefficients[1] = div(1, sub(xPoints[m], xPoints[1]));
        }

        let startIndex = m === 0 ? 2 : 1;

        for (let n = startIndex; n < xPoints.length; n++) {
          if (m === n) continue;

          for (let nc = xPoints.length - 1; nc >= 1; nc--) {
            newCoefficients[nc] = add(
              mul(newCoefficients[nc], div(neg(xPoints[n]), sub(xPoints[m], xPoints[n]))),
              div(newCoefficients[nc - 1], sub(xPoints[m], xPoints[n]))
            );
          }

          newCoefficients[0] = mul(newCoefficients[0], div(neg(xPoints[n]), sub(xPoints[m], xPoints[n])));
        }

        for (let nc = 0; nc < xPoints.length; nc++)
          coefficients[nc] = add(coefficients[nc], mul(yPoints[m], newCoefficients[nc]));
      }

      return new Polynomial(coefficients);

      // const ws = [];
      // const xs = [];
      // const ys = [];
      // if (points && points.length) {
      //   this.k = points.length;
      //   points.forEach(([ x, y ]) => {
      //     xs.push(x);
      //     ys.push(y);
      //   });
      //   for (let w, j = 0; j < k; j++) {
      //     w = 1;
      //     for (let i = 0; i < k; i++) if (i !== j) w *= xs[j] - xs[i];
      //     ws[j] = 1 / w;
      //   }
      // }

      // var poly = this['coeff'];
      // function objectToArray(obj) {
      //   const keys = Object.keys(obj).sort((a, b) => parseInt(a) - parseInt(b));
      //   const result = [];
      //   keys.forEach(key => {
      //       const value = obj[key];
      //       const filledValue = value !== undefined && value !== null ? value : 0;
      //       result.push(filledValue);
      //   });

      //   return result;
      // }
      // return objectToArray(poly);
    };

    /**
     * compose polynomial
     * 
     * @param {Polynomial} poly polynomial to compose inside
     * @returns {Polynomial}
     */
    Polynomial.prototype['compose'] = function(poly) {
        let parse = FIELD["parse"];
        let empty = FIELD["empty"];

      let result = new Polynomial([parse(0)]);

      let currentPower = new Polynomial([parse(1)]);
  
      let degree = this.degree();
      for (let i = 0; i <= degree; i++) {
        if (!empty(this.coeff[i])) {
            const term = currentPower.mul( this.coeff[i]);
            result = result.add( term);
          }
          currentPower = currentPower.mul(poly);
      }

      return result;
    };
  
    /**
     * Clones the actual object
     * 
     * @returns {Polynomial}
     */
    Polynomial.prototype['clone'] = function() {
      return new Polynomial(this);
    };
  
    /**
     * Returns the degree of the polynomial
     * 
     * @returns {number}
     */
    Polynomial.prototype['degree'] = function() {
  
      return degree(this['coeff']);
    };
  
    /**
     * Set the field globally
     * 
     * @param {string|Object} field One of: C (complex), H (quaternion), Q (rational), R (real) or an object with methods for field
     */
    Polynomial['setField'] = function(field) {
  
      // Fields with the same common API
      var F = {
        "Q": Fraction,
        "C": Complex,
        "H": Quaternion
      }[field];
  
      if (F !== undefined) {
  
        FIELD = {
          "add": function(a, b) {
            return new F(a)['add'](b);
          },
          "sub": function(a, b) {
            return new F(a)['sub'](b);
          },
          "mul": function(a, b) {
            return new F(a)['mul'](b);
          },
          "div": function(a, b) {
            return new F(a)['div'](b);
          },
          "parse": function(x) {
            return new F(x);
          },
          "empty": function(x) {
            return new F(x)['equals'](0);
          },
          "pow": function(a, b) {
            return new F(a)['pow'](b);
          },
          "equals": function(a, b) {
            return new F(a)['equals'](b);
          }
        };
  
      } else if (!field || field === 'R') {
  
        FIELD = ORIG_FIELD;
  
      } else if (typeof field === 'object') {
  
        FIELD = field;
  
      } else if (field.charAt(0) === 'Z') {
  
        var N = +field.slice(1);
  
        FIELD = {// Test in Z_n
          "add": function(a, b) {
            return mod(a + b, N);
          },
          "sub": function(a, b) {
            return mod(a - b, N);
          },
          "mul": function(a, b) {
            return mod(a * b, N);
          },
          "div": function(a, b) {
            return mod(a * modinv(b, N), N);
          },
          "parse": function(x) {
            return parseInt(x, 10);
          },
          "empty": function(x) {
            return undefined === x || 0 === x;
          },
          "pow": function(a, b) {
  
            for (var r = 1; b > 0; a = mod(a * a, N), b >>= 1) {
  
              if (b & 1) {
                r = mod(r * a, N);
              }
            }
            return r;
          },
          "equals": function(a, b) {
            return a == b;
          }
        };
      }
    };
  
    /**
     * Set the finite field globally
     * 
     * @param {BigInt} r One of: C (complex), H (quaternion), Q (rational), R (real) or an object with methods for field
     */
    Polynomial["setFiniteField"] = function (r) {
      Polynomial.setField({
        add: function (a, b) {
          return (BigInt(a) + BigInt(b)) % r;
        },
        sub: function (a, b) {
          if (a <b)
          return (BigInt(a) + r - BigInt(b)) % r;
        else
          return (BigInt(a) - BigInt(b)) % r;
        },
        neg: function (a) {
          if (a>r)
          return (r - (BigInt(a) % r)) % r;
        else
        return (r - BigInt(a) ) % r;
        },
        mul: function (a, b) {
          return (BigInt(a) * BigInt(b)) % r;
        },
        div: function (a, b) {
          return (BigInt(a) * modInverse(BigInt(b), r)) % r;
        },
        parse: function (x) {
          if (x<0)
          return (BigInt(x) + r) % r;
        else
          return (BigInt(x) ) % r;
        },
        empty: function (x) {
          return !x || BigInt(x) == 0n;
        },
        pow: function (a, b) {
          let result = 1;
          let x = BigInt(a) % r;
          let d = BigInt(b);

          while (d > 0) {
            var leastSignificantBit = d % 2;
            d = d / 2;

            if (leastSignificantBit == 1) {
              result = (result * x) % r;
            }

            x = (x * x) % r;
          }
          return result;
        },
        abs: function (a) {
          return Math.abs(BigInt(a));
        },
      });
    };
  
    if (typeof define === 'function' && define['amd']) {
  
      define(["fraction.js", "complex.js", "quaternion"], function(frac, comp, quat) {
        Fraction = frac;
        Complex = comp;
        Quaternion = quat;
        return Polynomial;
      });
  
    } else if (typeof exports === 'object') {
  
      Fraction = require("fraction.js");
      Complex = require("complex.js");
      Quaternion = require("quaternion");
  
      Object.defineProperty(Polynomial, "__esModule", {'value': true});
      Polynomial['default'] = Polynomial;
      Polynomial['Polynomial'] = Polynomial;
      module['exports'] = Polynomial;
  
    } else {
  
      Fraction = root['Fraction'];
      Complex = root['Complex'];
      Quaternion = root['Quaternion'];
  
      root['Polynomial'] = Polynomial;
    }
  
  })(this);
  
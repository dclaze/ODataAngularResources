angular.module('ODataResources', ['ng']);;

angular.module('ODataResources').
  factory('$odataOperators', [function() {

      var rtrim = /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g;
      trim = function(value) {
        return value.replace(rtrim, '');
      };
        

  		var filterOperators =  {
  			'eq':['=','==','==='],
			'ne':['!=','!==','<>'],
			'gt':['>'],
			'ge':['>=','>=='],
			'lt':['<'],
			'le':['<=','<=='],
			'and':['&&'],
			'or':['||'],
			'not':['!'],
			'add':['+'],
			'sub':['-'],
			'mul':['*'],
			'div':['/'],
			'mod':['%'],
  		};

  		var convertOperator = function(from){
  			var input = trim(from).toLowerCase();
  			var key;
  			for(key in filterOperators)
  			{
  				if(input === key) return key;

  				var possibleValues = filterOperators[key];
  				for (var i = 0; i < possibleValues.length; i++) {
  					if(input === possibleValues[i]){
  						return key;
  					}
  				}
  			}

  			throw "Operator "+ from+" not found";
  		};

  		return {
  			operators : filterOperators,
  			convert:convertOperator,
  		};
  	}]);
;angular.module('ODataResources').
factory('$odataValue', [
	function() {

		var illegalChars = {
			'%': '%25',
			'+': '%2B',
			'/': '%2F',
			'?': '%3F',
			'#': '%23',
			'&': '%26'
		};

		var escapeIllegalChars = function(string){
			for(var key in illegalChars){
				string = string.replace(key,illegalChars[key]);
			}
			string = string.replace("'", "''");
			return string;
		};

		var ODataValue = function(input) {
			this.value = input;
		};

		ODataValue.prototype.execute = function() {
			if (typeof this.value === "string") {
				return "'" + escapeIllegalChars(this.value) + "'";
			} else if (this.value === false) {
				return "false";
			} else if (this.value === true) {
				return "true";
			} else if (!isNaN(this.value)) {
				return this.value;
			} else {
				throw "Unrecognized type of " + this.value;
			}
		};
		return ODataValue;
	}
]);;angular.module('ODataResources').
factory('$odataProperty', [function() {

var ODataProperty = function(input){
		this.value = input;
	};

	ODataProperty.prototype.execute = function(){
		return this.value;
	};
	return ODataProperty;
}]);
	;angular.module('ODataResources').
factory('$odataBinaryOperation', ['$odataOperators','$odataProperty','$odataValue',function($odataOperators,ODataProperty,ODataValue) {

	var ODataBinaryOperation = function(a1,a2,a3){
		if(a1===undefined){
			throw "The property of a filter cannot be undefined";
		}

		if(a2 === undefined){
			throw "The value of a filter cannot be undefined";
		}

		if(a3 === undefined){
			//If strings are specified, we assume that the first one is the object property and the second one its value

			if(angular.isFunction(a1.execute)){
				this.operandA = a1;
			}else{
				this.operandA = new ODataProperty(a1);
			}
			if(angular.isFunction(a2.execute)){
				this.operandB = a2;
			}else{
				this.operandB = new ODataValue(a2);
			}

			this.filterOperator = 'eq';
		}
		else{
			if(angular.isFunction(a1.execute)){
				this.operandA = a1;
			}else{
				this.operandA = new ODataProperty(a1);
			}
			if(angular.isFunction(a3.execute)){
				this.operandB = a3;
			}else{
				this.operandB = new ODataValue(a3);
			}

			this.filterOperator = $odataOperators.convert(a2);
		}
	};


	ODataBinaryOperation.prototype.execute = function(noParenthesis){
		var result = this.operandA.execute()+" "+this.filterOperator+" " +this.operandB.execute();
		if(!noParenthesis)
			result = "("+result+")";

		return result;
	};

	ODataBinaryOperation.prototype.or = function(a1,a2,a3){
		var other;
		if(a2!==undefined){
			other = new ODataBinaryOperation(a1,a2,a3);
		}
		else if(angular.isFunction(a1.execute)){
			other = a1;
		}
		else{
			throw "The object " +a1 +" passed as a parameter of the or method is not valid";
		}
		return new ODataBinaryOperation(this,"or",other);
	};

	ODataBinaryOperation.prototype.and = function(a1,a2,a3){
		var other;
		if(a2!==undefined){
			other = new ODataBinaryOperation(a1,a2,a3);
		}
		else if(angular.isFunction(a1.execute)){
			other = a1;
		}
		else{
			throw "The object " +a1 +" passed as a parameter of the and method is not valid";
		}
		return new ODataBinaryOperation(this,"and",other);
	};

	return ODataBinaryOperation;
}

]);;angular.module('ODataResources').
factory('$odataMethodCall', ['$odataProperty', '$odataValue',
    function(ODataProperty, ODataValue) {

        var ODataMethodCall = function(methodName) {
            if (methodName === undefined || methodName === "")
                throw "Method name should be defined";

            this.params = [];

            if (arguments.length < 2)
                throw "Method should be invoked with arguments";

            for (var i = 1; i < arguments.length; i++) {
                var value = arguments[i];
                if (angular.isFunction(value.execute)) {
                    this.params.push(value);
                } else {
                    //We assume the first one is the object property;
                    if (i == 1) {
                        this.params.push(new ODataProperty(value));
                    } else {
                        this.params.push(new ODataValue(value));
                    }
                }
            }

            this.methodName = methodName;
        };

        ODataMethodCall.prototype.execute = function() {
            var invocation = this.methodName + "(";
            for (var i = 0; i < this.params.length; i++) {
                if (i > 0)
                    invocation += ",";

                invocation += this.params[i].execute();
            }
            invocation += ")";
            return invocation;
        };

        return ODataMethodCall;
    }
]);;angular.module('ODataResources').
factory('$odataOrderByStatement', [function($odataOperators,ODataBinaryOperation,ODataPredicate) {

	var ODataOrderByStatement = function(propertyName, sortOrder){
		if(propertyName===undefined){
			throw "Orderby should be passed a property name but got undefined";
		}

		this.propertyName = propertyName;

		this.direction = sortOrder || "asc";
	};

	ODataOrderByStatement.prototype.execute = function() {
		return this.propertyName+" "+this.direction;
	};

	return ODataOrderByStatement;
}]);;angular.module('ODataResources').
factory('$odataPredicate', ['$odataBinaryOperation',function(ODataBinaryOperation) {



	var ODataPredicate = function(a1,a2,a3){
		if(angular.isFunction(a1.execute) && a2 === undefined){
			return a1;
		}
		else{
			return new ODataBinaryOperation(a1,a2,a3);
		}
	};

	ODataPredicate.and = function(andStatements){
		if(andStatements.length>0){
			var finalOperation = andStatements[0];

			for (var i = 1; i < andStatements.length; i++) {
				finalOperation = new ODataBinaryOperation(finalOperation,'and',andStatements[i]);
			}
			return finalOperation;
		}
		throw "No statements specified";
	};

	ODataPredicate.or = function(orStatements){
		if(orStatements.length>0){
			var finalOperation = orStatements[0];

			for (var i = 1; i < orStatements.length; i++) {
				finalOperation = new ODataBinaryOperation(finalOperation,'or',orStatements[i]);
			}
			return finalOperation;
		}
		throw "No statements specified for OR predicate";
	};


	ODataPredicate.create = function(a1,a2,a3){
		if(angular.isFunction(a1.execute) && a2 === undefined){
			return a1;
		}
		else{
			return new ODataBinaryOperation(a1,a2,a3);
		}
	};

	return ODataPredicate;

}]);
;angular.module('ODataResources').
factory('$odataProvider', ['$odataOperators', '$odataBinaryOperation', '$odataPredicate', '$odataOrderByStatement',
	function($odataOperators, ODataBinaryOperation, ODataPredicate, ODataOrderByStatement) {
		var ODataProvider = function(callback) {
			this.callback = callback;

			this.filters = [];
			this.sortOrders = [];
			this.takeAmount = undefined;
			this.skipAmount = undefined;
		};

		ODataProvider.prototype.filter = function(operand1, operand2, operand3) {
			if(operand1 ===undefined)
				throw "The first parameted is undefined. Did you forget to invoke the method as a constructor by adding the 'new' keyword?";

			var predicate;
			if (angular.isFunction(operand1.execute) && operand2 === undefined) {
				predicate = operand1;
			} else {
				predicate = new ODataBinaryOperation(operand1, operand2, operand3);
			}
			this.filters.push(predicate);
			return this;
		};

		ODataProvider.prototype.orderBy = function(arg1, arg2) {
			this.sortOrders.push(new ODataOrderByStatement(arg1, arg2));
			return this;
		};

		ODataProvider.prototype.take = function(amount) {
			this.takeAmount = amount;
			return this;
		};
		ODataProvider.prototype.skip = function(amount) {
			this.skipAmount = amount;
			return this;
		};

		ODataProvider.prototype.execute = function() {
			var queryString = '';
			if (this.filters.length > 0) {
				queryString = "$filter=" + ODataPredicate.and(this.filters).execute(true);
			}

			if (this.sortOrders.length > 0) {
				if (queryString !== "") queryString += "&";

				queryString += "$orderby=";
				for (var i = 0; i < this.sortOrders.length; i++) {
					if (i > 0) {
						queryString += ",";
					}
					queryString += this.sortOrders[i].execute();
				}
			}

			if (this.takeAmount) {
				if (queryString !== "") queryString += "&";
				queryString += "$top=" + this.takeAmount;
			}


			if (this.skipAmount) {
				if (queryString !== "") queryString += "&";
				queryString += "$skip=" + this.skipAmount;
			}


			return queryString;
		};

		ODataProvider.prototype.query = function(success,error) {
			if (angular.isFunction(this.callback))
				return this.callback(this.execute(),success,error);
		};

		return ODataProvider;
	}
]);;/**
 * @license AngularJS v1.3.15
 * (c) 2010-2014 Google, Inc. http://angularjs.org
 * License: MIT
 */
(function(window, angular, undefined) {
  'use strict';

  var $resourceMinErr = angular.$$minErr('$resource');

  // Helper functions and regex to lookup a dotted path on an object
  // stopping at undefined/null.  The path must be composed of ASCII
  // identifiers (just like $parse)
  var MEMBER_NAME_REGEX = /^(\.[a-zA-Z_$@][0-9a-zA-Z_$@]*)+$/;

  function isValidDottedPath(path) {
    return (path !== null && path !== '' && path !== 'hasOwnProperty' &&
      MEMBER_NAME_REGEX.test('.' + path));
  }

  function lookupDottedPath(obj, path) {
    if (!isValidDottedPath(path)) {
      throw $resourceMinErr('badmember', 'Dotted member path "@{0}" is invalid.', path);
    }
    var keys = path.split('.');
    for (var i = 0, ii = keys.length; i < ii && obj !== undefined; i++) {
      var key = keys[i];
      obj = (obj !== null) ? obj[key] : undefined;
    }
    return obj;
  }

  /**
   * Create a shallow copy of an object and clear other fields from the destination
   */
  function shallowClearAndCopy(src, dst) {
    dst = dst || {};

    angular.forEach(dst, function(value, key) {
      delete dst[key];
    });

    for (var key in src) {
      if (src.hasOwnProperty(key) && !(key.charAt(0) === '$' && key.charAt(1) === '$')) {
        dst[key] = src[key];
      }
    }

    return dst;
  }


  angular.module('ODataResources').
  provider('$odataresource', function() {
    var provider = this;

    this.defaults = {
      // Strip slashes by default
      stripTrailingSlashes: true,

      // Default actions configuration
      actions: {
        'get': {
          method: 'GET'
        },
        'save': {
          method: 'POST'
        },
        'query': {
          method: 'GET',
          isArray: true
        },
        'remove': {
          method: 'DELETE'
        },
        'delete': {
          method: 'DELETE'
        },
        'odata': {
          method: 'GET',
          isArray: true
        }
      }
    };

    this.$get = ['$http', '$q', '$odata',
      function($http, $q, $odata) {

        var noop = angular.noop,
          forEach = angular.forEach,
          extend = angular.extend,
          copy = angular.copy,
          isFunction = angular.isFunction;

        /**
         * We need our custom method because encodeURIComponent is too aggressive and doesn't follow
         * http://www.ietf.org/rfc/rfc3986.txt with regards to the character set
         * (pchar) allowed in path segments:
         *    segment       = *pchar
         *    pchar         = unreserved / pct-encoded / sub-delims / ":" / "@"
         *    pct-encoded   = "%" HEXDIG HEXDIG
         *    unreserved    = ALPHA / DIGIT / "-" / "." / "_" / "~"
         *    sub-delims    = "!" / "$" / "&" / "'" / "(" / ")"
         *                     / "*" / "+" / "," / ";" / "="
         */
        function encodeUriSegment(val) {
          return encodeUriQuery(val, true).
          replace(/%26/gi, '&').
          replace(/%3D/gi, '=').
          replace(/%2B/gi, '+');
        }


        /**
         * This method is intended for encoding *key* or *value* parts of query component. We need a
         * custom method because encodeURIComponent is too aggressive and encodes stuff that doesn't
         * have to be encoded per http://tools.ietf.org/html/rfc3986:
         *    query       = *( pchar / "/" / "?" )
         *    pchar         = unreserved / pct-encoded / sub-delims / ":" / "@"
         *    unreserved    = ALPHA / DIGIT / "-" / "." / "_" / "~"
         *    pct-encoded   = "%" HEXDIG HEXDIG
         *    sub-delims    = "!" / "$" / "&" / "'" / "(" / ")"
         *                     / "*" / "+" / "," / ";" / "="
         */
        function encodeUriQuery(val, pctEncodeSpaces) {
          return encodeURIComponent(val).
          replace(/%40/gi, '@').
          replace(/%3A/gi, ':').
          replace(/%24/g, '$').
          replace(/%2C/gi, ',').
          replace(/%20/g, (pctEncodeSpaces ? '%20' : '+'));
        }

        function Route(template, defaults) {
          this.template = template;
          this.defaults = extend({}, provider.defaults, defaults);
          this.urlParams = {};
        }

        Route.prototype = {
          setUrlParams: function(config, params, actionUrl) {
            var self = this,
              url = actionUrl || self.template,
              val,
              encodedVal;

            var urlParams = self.urlParams = {};
            forEach(url.split(/\W/), function(param) {
              if (param === 'hasOwnProperty') {
                throw $resourceMinErr('badname', "hasOwnProperty is not a valid parameter name.");
              }
              if (!(new RegExp("^\\d+$").test(param)) && param &&
                (new RegExp("(^|[^\\\\]):" + param + "(\\W|$)").test(url))) {
                urlParams[param] = true;
              }
            });
            url = url.replace(/\\:/g, ':');

            params = params || {};
            forEach(self.urlParams, function(_, urlParam) {
              val = params.hasOwnProperty(urlParam) ? params[urlParam] : self.defaults[urlParam];
              if (angular.isDefined(val) && val !== null) {
                encodedVal = encodeUriSegment(val);
                url = url.replace(new RegExp(":" + urlParam + "(\\W|$)", "g"), function(match, p1) {
                  return encodedVal + p1;
                });
              } else {
                url = url.replace(new RegExp("(\/?):" + urlParam + "(\\W|$)", "g"), function(match,
                  leadingSlashes, tail) {
                  if (tail.charAt(0) == '/') {
                    return tail;
                  } else {
                    return leadingSlashes + tail;
                  }
                });
              }
            });

            // strip trailing slashes and set the url (unless this behavior is specifically disabled)
            if (self.defaults.stripTrailingSlashes) {
              url = url.replace(/\/+$/, '') || '/';
            }

            // then replace collapse `/.` if found in the last URL path segment before the query
            // E.g. `http://url.com/id./format?q=x` becomes `http://url.com/id.format?q=x`
            url = url.replace(/\/\.(?=\w+($|\?))/, '.');
            // replace escaped `/\.` with `/.`
            config.url = url.replace(/\/\\\./, '/.');


            // set params - delegate param encoding to $http
            forEach(params, function(value, key) {
              if (!self.urlParams[key]) {
                config.params = config.params || {};
                config.params[key] = value;
              }
            });
          }
        };


        function resourceFactory(url, paramDefaults, actions, options) {
          var route = new Route(url, options);

          actions = extend({}, provider.defaults.actions, actions);

          function extractParams(data, actionParams) {
            var ids = {};
            actionParams = extend({}, paramDefaults, actionParams);
            forEach(actionParams, function(value, key) {
              if (isFunction(value)) {
                value = value();
              }
              ids[key] = value && value.charAt && value.charAt(0) == '@' ?
                lookupDottedPath(data, value.substr(1)) : value;
            });
            return ids;
          }

          function defaultResponseInterceptor(response) {
            return response.resource;
          }

          function Resource(value) {
            shallowClearAndCopy(value || {}, this);
          }

          Resource.prototype.toJSON = function() {
            var data = extend({}, this);
            delete data.$promise;
            delete data.$resolved;
            return data;
          };

          forEach(actions, function(action, name) {

            var hasBody = /^(POST|PUT|PATCH)$/i.test(action.method);

            Resource[name] = function(a1, a2, a3, a4, isOdata, odataQueryString) {
              var params = {}, data, success, error;

              /* jshint -W086 */
              /* (purposefully fall through case statements) */
              switch (arguments.length) {
                case 6:
                case 4:
                  error = a4;
                  success = a3;
                  //fallthrough
                case 3:
                case 2:
                  if (isFunction(a2)) {
                    if (isFunction(a1)) {
                      success = a1;
                      error = a2;
                      break;
                    }

                    success = a2;
                    error = a3;
                    //fallthrough
                  } else {
                    params = a1;
                    data = a2;
                    success = a3;
                    break;
                  }
                case 1:
                  if (isFunction(a1)) success = a1;
                  else if (hasBody) data = a1;
                  else params = a1;
                  break;
                case 0:
                  break;
                default:
                  throw $resourceMinErr('badargs',
                    "Expected up to 4 arguments [params, data, success, error], got {0} arguments",
                    arguments.length);
              }
              /* jshint +W086 */
              /* (purposefully fall through case statements) */

              var isInstanceCall = this instanceof Resource;
              var value = isInstanceCall ? data : (action.isArray ? [] : new Resource(data));
              var httpConfig = {};
              var responseInterceptor = action.interceptor && action.interceptor.response ||
                defaultResponseInterceptor;
              var responseErrorInterceptor = action.interceptor && action.interceptor.responseError ||
                undefined;

              forEach(action, function(value, key) {
                if (key != 'params' && key != 'isArray' && key != 'interceptor') {
                  httpConfig[key] = copy(value);
                }
              });

              if (hasBody) httpConfig.data = data;

              route.setUrlParams(httpConfig,
                extend({}, extractParams(data, action.params || {}), params),
                action.url);

              if(isOdata && odataQueryString!==""){
                httpConfig.url += "?"+odataQueryString;                
              }

              var promise = $http(httpConfig).then(function(response) {
                var data = response.data,
                  promise = value.$promise;

                if (data) {
                  // Need to convert action.isArray to boolean in case it is undefined
                  // jshint -W018
                  if (angular.isArray(data) !== ( !! action.isArray)) {
                    throw $resourceMinErr('badcfg',
                      'Error in resource configuration for action `{0}`. Expected response to ' +
                      'contain an {1} but got an {2} (Request: {3} {4})', name, action.isArray ? 'array' : 'object',
                      angular.isArray(data) ? 'array' : 'object', httpConfig.method, httpConfig.url);
                  }
                  // jshint +W018
                  if (action.isArray) {
                    value.length = 0;
                    forEach(data, function(item) {
                      if (typeof item === "object") {
                        value.push(new Resource(item));
                      } else {
                        // Valid JSON values may be string literals, and these should not be converted
                        // into objects. These items will not have access to the Resource prototype
                        // methods, but unfortunately there
                        value.push(item);
                      }
                    });
                  } else {
                    shallowClearAndCopy(data, value);
                    value.$promise = promise;
                  }
                }

                value.$resolved = true;

                response.resource = value;

                return response;
              }, function(response) {
                value.$resolved = true;

                (error || noop)(response);

                return $q.reject(response);
              });

              promise = promise.then(
                function(response) {
                  var value = responseInterceptor(response);
                  (success || noop)(value, response.headers);
                  return value;
                },
                responseErrorInterceptor);

              if (!isInstanceCall) {
                // we are creating instance / collection
                // - set the initial promise
                // - return the instance / collection
                value.$promise = promise;
                value.$resolved = false;

                return value;
              }

              // instance call
              return promise;
            };


            Resource.prototype['$' + name] = function(params, success, error) {
              if (isFunction(params)) {
                error = success;
                success = params;
                params = {};
              }
              var result = Resource[name].call(this, params, this, success, error);
              return result.$promise || result;
            };
          });

          var oldOdataResource = Resource.odata;
          Resource.odata = function() {
            var onQuery = function(queryString, success, error) {
              return oldOdataResource({}, {}, success, error, true, queryString);
            };


            return new $odata.Provider(onQuery);
          };

          Resource.bind = function(additionalParamDefaults) {
            return resourceFactory(url, extend({}, paramDefaults, additionalParamDefaults), actions);
          };

          return Resource;
        }

        return resourceFactory;
      }
    ];
  });


})(window, window.angular);;angular.module('ODataResources').
factory('$odata', ['$odataBinaryOperation','$odataProvider','$odataValue',
	'$odataProperty','$odataMethodCall','$odataPredicate','$odataOrderByStatement',
	function(ODataBinaryOperation,ODataProvider,ODataValue,ODataProperty,ODataMethodCall,ODataPredicate,ODataOrderByStatement) {

		return {
			Provider : ODataProvider,
			BinaryOperation : ODataBinaryOperation,
			Value : ODataValue,
			Property : ODataProperty,
			Func : ODataMethodCall,
			Predicate : ODataPredicate,
			OrderBy : ODataOrderByStatement,
		};

	}]);
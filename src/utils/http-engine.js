'use strict';

const https = require('https');

const Method = Object.freeze({
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  PATCH: 'PATCH',
  DELETE: 'DELETE',
  HEAD: 'HEAD',
  _: {
    successCodes: {
      GET: 200,
      POST: 200,
      PUT: 200,
      PATCH: 200,
      DELETE: 200
    },
    createSuccess: {
      POST: 201,
      PUT: 201,
      PATCH: 201
    }
  }
});

const httpSession = (request) => {
  return new Promise(async (resolve, reject) => {
    let {
      method,
      hostname,
      path,
      port,
      headers,
      body
    } = request;

    if (!(method in Method)) {
      return reject(new Error('Invalid method supplied.'));
    }

    const options = {
      hostname: hostname,
      path: path,
      method: method || Method.GET,
    }

    if (port) options.port = port;

    const successCode = !body ? Method._.successCodes[method] : Method._.createSuccess[method];

    if (headers && headers.constructor === Object) {
      options.headers = headers;
    }

    if (body) {
      if (!headers['Content-Type']) {
        return reject(new Error('Content-Type is not defined.'));
      }

      if (headers['Content-Type'].toLowerCase() === 'application/x-www-form-urlencoded'
      && body.constructor !== String) {
        return reject(new Error('Invalid body format.'));
      }

      if (headers['Content-Type'].toLowerCase() === 'application/json') {
        if (body.constructor === Object || Array.isArray(body)) {
          body = JSON.stringify(body);
        } else if (typeof body !== 'string') {
          return reject(new Error('Invalid body format.'));
        }
      }
    }

    const req = https.request(options, (res) => {
      let resData;

      res.on('data', chunk => resData += chunk);
      res.on('end', () => {
        if (res.statusCode === successCode) {
          return resolve(resData);
        }
        if (resData) {
          return reject(resData);
        }
        return reject(res.statusCode);
      });
    });

    req.on('error', (e) => {
      return reject(e);
    });

    if (body) req.write(body);
    req.end();
  });
};

class Http {
  /**
   * Constructor Method
   * @param {Object} options options to apply on initialization
   */
  constructor(options = {}) {
    this._ = {};
    Object.keys(options).forEach(prop => this._[prop] = options[prop]);
    this._callbacks = {};
  }


  /**
   * PROPERTIES
   */
  /**
   * Base URL Getter
   * @return {String} host string
   */
  get host() {
    return !this._.host ? '' : this._.host;
  }

  /**
   * Base URL Setter
   * @param  {String} url string argument to set as baseURL property
   */
  set host(url) {
    if (url && url.constructor === String) {
      this._.host = url;
    }
  }

  /**
   * Base Headers Getter
   * @return {{String : Sting}} baseHeaders object
   */
  get baseHeaders() {
    return !this._.baseHeaders ? {} : this._.baseHeaders;
  }

  /**
   * Base Headers Setter
   * @param  {{String : Sting}} headers object argument to set as baseHeaders property
   */
  set baseHeaders(headers) {
    if (headers && headers.constructor === Object) {
      this._.baseHeaders = headers;
    } else {
      this._.baseHeaders = !this.baseHeaders ? {} : this.baseHeaders;
    }
  }


  /**
   * REQUEST METHODS
   */
  /**
   * GET requester method
   * @param  {String}             uri     URI string to append to baseURL.
   * @param  {{String : Sting}}   headers headers to append the baseHeaders
   * @return {Promise}            promise object to be fulfilled in request
   */
  get(uri, headers) {
    return this.fetch({
      method: Method.GET,
      uri: uri,
      headers: headers
    });
  }

  /**
   * POST requester method
   * @param  {String}             uri     URI string to append to baseURL.
   * @param  {{String : Sting}}   headers headers to append the baseHeaders
   * @param  {Any}                body    body to send in request
   * @return {Promise}                    promise object to be fulfilled in request
   */
  post(uri, headers, body) {
    return this.fetch({
      method: Method.POST,
      uri: uri,
      headers: headers,
      body: body
    });
  }

  /**
   * PUT requester method
   * @param  {String}             uri     URI string to append to baseURL.
   * @param  {{String : Sting}}   headers headers to append the baseHeaders
   * @param  {Any}                body    body to send in request
   * @return {Promise}                    promise object to be fulfilled in request
   */
  put(uri, headers, body) {
    return this.fetch({
      method: Method.PUT,
      uri: uri,
      headers: headers,
      body: body
    });
  }

  /**
   * PATCH requester method
   * @param  {String}             uri     URI string to append to baseURL.
   * @param  {{String : Sting}}   headers headers to append the baseHeaders
   * @param  {Any}                body    body to send in request
   * @return {Promise}                    promise object to be fulfilled in request
   */
  patch(uri, headers, body) {
    return this.fetch({
      method: Method.PATCH,
      uri: uri,
      headers: headers,
      body: body
    });
  }

  /**
   * DELETE requester method
   * @param  {String}             uri     URI string to append to baseURL.
   * @param  {{String : Sting}}   headers headers to append the baseHeaders
   * @return {Promise}                    promise object to be fulfilled in request
   */
  delete(uri, headers) {
    return this.fetch({
      method: Method.DELETE,
      uri: uri,
      headers: headers
    });
  }

  /**
   * FETCH requester method
   * @param  {Object} request parameters for fetch request
   * @return {Promise} promise object to be fulfilled in request
   */
  fetch(request) {
    return new Promise(async (resolve, reject) => {
      const { uri, headers } = request;

      if (this.host) request.host = this.host;
      request.path = uri;
      if (headers) request.headers = Object.assign(this.baseHeaders, headers);

      this._handleRequest(request);

      try {
        const res = await httpSession(request);

        this._handleSuccess(res);
        return resolve(res);
      } catch (e) {
        this._handleError(e);
        return reject(e);
      }
    });
  }

  /**
   * EVENT HANDLER METHODS
   */

  onRequest(cb) {
    return this._applyCallback('onRequest', cb);
  }

  /**
   * [onError description]
   * @param  {Function} cb  Callback function that executes on request calls error
   * @return {Http}        Current Http Object
   */
  onError(cb) {
    return this._applyCallback('onError', cb);
  }

  /**
   * [onSuccess description]
   * @param  {Function} cb  Callback function that executes on request calls successes
   * @return {Http}        Current Http Object
   */
  onSuccess(cb) {
    return this._applyCallback('onSuccess', cb);
  }

  /**
   * Internal Methods
   * @param  {String} key  Name of listener
   * @param  {Function} cb  Callback function that executes on request calls successes
   * @return {Http}        Current Http Object
   */
  _applyCallback(key, cb) {
    if (typeof cb === 'function') {
      this._callbacks[key] = e => cb(e);
    }

    return this;
  }

  _handleRequest(e) {
    const cb = this._callbacks.onRequest;

    if (cb) {
      return cb(e);
    }
  }

  _handleError(e) {
    const cb = this._callbacks.onError;

    if (cb) {
      return cb(e);
    }
  }

  _handleSuccess(e) {
    const cb = this._callbacks.onSuccess;

    if (cb) {
      return cb(e);
    }
  }
}

module.exports = Http;

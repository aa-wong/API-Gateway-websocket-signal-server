'use strict';

const statusDecription = (code) => {
  switch (code) {
    // SUCCESSFUL
    case 200:
      return "OK";
    case 201:
      return "CREATED";
    case 202:
      return "ACCEPTED";
    case 203:
      return "NON-AUTHORITATIVE-INFORMATION";
    case 204:
      return "NO CONTENT";
    case 205:
      return "RESET CONTENT";
    case 206:
      return "PARTIAL CONTENT";

    // CLIENT ERROR
    case 400:
      return "BAD REQUEST";
    case 401:
      return "UNAUTHORIZED";
    case 402:
      return "PAYMENT REQUIRED";
    case 403:
      return "DENIED";
    case 404:
      return "NOT FOUND";
    case 405:
      return "METHOD NOT ALLOWED";
    case 406:
      return "NOT ACCEPTABLE";
    case 407:
      return "PROXY AUTHENTICATION REQUIRED";
    case 408:
      return "REQUEST TIMEOUT";
    case 409:
      return "CONFLICT";
    case 410:
      return "GONE";
    case 411:
      return "LENGTH REQUIRED";
    case 412:
      return "PRECONDITION FAILED";
    case 413:
      return "REQUEST ENTITY TOO LARGE";
    case 414:
      return "REQUEST-URI TOO LONG";
    case 415:
      return "UNSUPPORTED MEDIA TYPE";
    case 416:
      return "REQUESTED RANGE NOT SATISFIABLE";
    case 417:
      return "EXPECTATION FAILED";

    // SERVER ERROR
    case 500:
      return "INTERNAL SERVER ERROR";
    case 501:
      return "NOT IMPLEMENTED";
    case 500:
      return "BAD GATEWAY";
    case 500:
      return "SERVICE UNAVAILABLE";
    case 500:
      return "GATEWAY TIMEOUT";
    case 500:
      return "HTTP VERSION NOT SUPPORTED";
    case 500:
      return "NETWORK AUTHENTICATION REQUIRED";

    default:
      return "INTERNAL SERVER ERROR";;
  }
}

module.exports = (status, message='', data, more_info={}, paging) => {
  let payload = {
    meta: {
      status_code: status,
      status: statusDecription(status),
      message,
      more_info
    }
  };

  if (data) payload.data = data;

  if (paging) payload.paging = paging;

  return {
    statusCode: status,
    body: JSON.stringify(payload)
  };
}

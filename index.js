'use strict';

const Alexa = require('alexa-sdk');
const https = require('https');
const http = require('http');
const APP_ID = process.env.APP_ID;

const handlers = {
    'LaunchRequest': function() {
        // Get permission
        if (!this.event.context.System.user.permissions.consentToken) {
            this.emit(':tellWithPermissionCard', 'To find your MP, I need your postcode. Please grant me permission in the skills section of the Alexa App.', ['read::alexa:device:all:address:country_and_postal_code']);
        } else {
            let options = {
                host: 'api.eu.amazonalexa.com',
                port: 443,
                path: '/v1/devices/' + this.event.context.System.device.deviceId + '/settings/address/countryAndPostalCode',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': 'Bearer ' + this.event.context.System.user.permissions.consentToken
                }
            };

            getData(https, options, (loc_data) => {
                options = {
                    host: 'data.parliament.uk',
                    port: 80,
                    path: '/membersdataplatform/services/mnis/members/query/fymp=' + loc_data.postalCode.replace(/ /g, '') + '/',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                };

                getData(http, options, (mp_data) => {
                    // Tell user
                    if (mp_data && mp_data.Members && mp_data.Members.Member && mp_data.Members.Member.DisplayAs) {
                        let member = mp_data.Members.Member;
                        let speech = 'Your MP is ' + member.DisplayAs + '. ' +
                            ((member.Gender && member.Party && member.Party['#text'] && member.MemberFrom && member.HouseStartDate) ? ((member.Gender == 'M' ? 'He\'s' : (member.Gender == 'F' ? 'She\'s' : 'They\'re')) +
                            ' a member of the ' +
                            member.Party['#text'] + ' party, and ' + (member.Gender == 'F' || member.Gender == 'M' ? 'has' : 'have') + ' been MP for ' + member.MemberFrom + ' since ' +
                            (new Date(member.HouseStartDate).getFullYear()) + '.') : '');

                        let title = member.FullTitle;
                        let text = speech;

                        /* Not used as data.parliament.uk doesn't support HTTPS!
                        let image = {
                            smallImageUrl: 'http://data.parliament.uk/membersdataplatform/services/images/MemberPhoto/' + member['@Member_Id'] + '/',
                            largeImageUrl: 'http://data.parliament.uk/membersdataplatform/services/images/MemberPhoto/' + member['@Member_Id'] + '/'
                        };
                        */

                        this.emit(':tellWithCard', speech, title, text);
                    } else {
                        this.emit(':tell', 'Sorry, I couldn\'t find an MP for postcode ' + loc_data.postalCode + '. You can change your postcode in the Alexa app settings.');
                    }
                });
            });
        }
    },
    'AMAZON.HelpIntent': function() {
        this.emit(':tell', 'Who\'s my MP can find your MP using your postcode. You can change your postcode in the Alexa app settings.');
    },
    'AMAZON.CancelIntent': function() {
        this.emit(':tell', 'Ok, Bye!');
    },
    'AMAZON.StopIntent': function() {
        this.emit(':tell', 'Ok, Bye!');
    },
    'Unhandled': function() {
        this.emit(':ask', 'Sorry, I didn\'t get that. Please can you repeat it?', 'Sorry, what was that?');
    }
};

// Gets JSON data from a HTTP(S) source.
function getData(requester, url, callback) {
    let req = requester.get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            // Replace &ufeff
            try {
                callback(JSON.parse(data.replace('﻿', '')));
            } catch (e) {
                console.error('err: ', e);
                console.error('url: ', url);
                callback(null);
            }
        });
    }).on('error', (err) => {
        console.error('err: ', e);
        console.error('url: ', url);
        callback(null);
    });
}

exports.handler = function(event, context) {
    const alexa = Alexa.handler(event, context);
    alexa.appId = APP_ID;
    alexa.registerHandlers(handlers);
    alexa.execute();
};

'use strict';
angular.module('Services', []);
angular.module('Constants', []);
angular.module('Directives', []);

var module = angular.module('app', ['Constants', 'ui.router', 'Services', 'ngCookies', 'templates', 'Directives']);


module.controller('authController', function($scope) {

}).config(function($stateProvider, $locationProvider, $urlRouterProvider) {

    var templatesPath = '/templates/login/';

    $stateProvider.state('main', {
        abstract: true,
        template: "<div ui-view class='main-wrapper-section'></div>",
        controller: function(authService, $rootScope, $scope, SocialAuthService) {

            $scope.advancedSocialRequest = {};

            $scope.socialAuthError = false;
            var onSocialAuth = function(response) {
                window.location = window.location.href;
            };

            var errorSocialAuth = function(response, request, type) {
                $scope.socialAuthInfo = {
                    network: type,
                    request: request
                };
                switch (response.status) {
                    case 403:
                        $scope.socialAuthError = response.data.detail;
                        switch (response.status) {
                            case '1030':
                                break;
                            case '1031':
                                break;
                            case '1032':
                                break;
                            case '1033':
                                break;
                        }
                        break;
                }
            };


            $scope.fbLogin = function(advancedData) {
                SocialAuthService.facebookAuth(onSocialAuth, errorSocialAuth, advancedData);
            };
            $scope.googleLogin = function(advancedData) {
                SocialAuthService.googleAuth(onSocialAuth, errorSocialAuth, advancedData);
            };

            $scope.continueSocialAuth = function(form) {
                if (!form.$valid) return;
                switch ($scope.socialAuthInfo.network) {
                    case 'google':
                        $scope.googleLogin($scope.socialAuthInfo.request);
                        break;
                    case 'facebook':
                        $scope.fbLogin($scope.socialAuthInfo.request);
                        break;
                }
            };

            authService.profile().then(function(response) {
                var profile = response.data;
                if (!profile.is_ghost) {
                    window.location = '/dashboard/';
                } else {
                    $rootScope.onCheck = true;
                }
            }, function(response) {
                $rootScope.onCheck = true;
            });
        }
    }).state('main.login', {
        url: '/',
        templateUrl: templatesPath + 'auth.html',
        controller: 'authController'
    }).state('main.forgot', {
        url: '/forgot-password',
        templateUrl: templatesPath + 'forgot-password.html',
        controller: function ($scope, authService) {
            $scope.request = {};
            $scope.sendResetPassForm = function(resetForm) {
                if (!resetForm.$valid) return;
                $scope.serverErrors = undefined;

                $scope.successText = false;

                authService.passwordReset($scope.request.email).then(function (response) {
                    $scope.successText = response.data.detail;
                    // window.location = '/';
                }, function (response) {
                    switch (response.status) {
                        case 400:
                            $scope.serverErrors = response.data;
                            break;
                    }
                });
            }
        }
    }).state('main.registration', {
        url: '/registration',
        templateUrl: templatesPath + 'registration.html',
        controller: function ($scope, authService, $state) {
            $scope.request = {};

            $scope.sendRegForm = function(regForm) {
                if (!regForm.$valid) return;
                $scope.request.username = $scope.request.email;
                $scope.serverErrors = undefined;
                authService.registration({
                    data: $scope.request
                }).then(function(response) {
                    $state.go('main.confirm');
                }, function(response) {
                    switch (response.status) {
                        case 400:
                            $scope.serverErrors = response.data;
                            break;
                    }
                });
            };
        }

    }).state('main.reset', {
        url: '/reset-password/:uid/:token',
        templateUrl: templatesPath + 'reset-password.html',
        controller: function ($scope, authService, $state, $stateParams) {
            $scope.request = {
                uid: $stateParams.uid,
                token: $stateParams.token
            };
            $scope.sendConfirmPass = function(passForm) {
                if (!passForm.$valid) return;
                authService.passwordChange($scope.request).then(function() {
                    $state.go('main.login');
                }, function (response) {
                    switch (response.status) {
                        case 400:
                            $scope.serverErrors = response.data;
                            break;

                        case 403:
                            switch (response.data.detail) {
                                case '1021':
                                    $scope.twoFAEnabled = true;
                                    break;
                                case '1022':
                                    $scope.serverErrors = {totp: 'Invalid code'};
                                    break;
                            }
                            break;
                    }
                });
            };

        }
    }).state('main.confirm', {
        url: '/notification',
        templateUrl: templatesPath + 'email-confirm.html'
    });

    $locationProvider.html5Mode({
        enabled: true,
        requireBase: false
    });
}).run(function($state, $rootScope) {
    $rootScope.$state = $state;
}).config(function($httpProvider, $qProvider) {
    $httpProvider.defaults.xsrfCookieName = 'csrftoken';
    $httpProvider.defaults.xsrfHeaderName = 'X-CSRFToken';
    $qProvider.errorOnUnhandledRejections(false);
});

angular.module('app').controller('contractsController', function(CONTRACT_STATUSES_CONSTANTS, $rootScope,
                                                                 contractsList, $scope, $state, contractService) {

    $scope.statuses = CONTRACT_STATUSES_CONSTANTS;
    $scope.stateData  = $state.current.data;

    var contractsData = contractsList.data;
    $scope.contractsList = contractsData.results;

    var url = 'https://www.myetherwallet.com/?';
    var params = [
        'sendMode=ether'
    ];
    var depositUrl = url + params.join('&');
    var killUrl = url + params.join('&');



    $scope.iniContract = function(contract) {
        if (!contract.contract_details.eth_contract) return;
        var depositParams = ['to=' + contract.contract_details.eth_contract.address, 'gaslimit=30000', 'value=0'];
        var killParams = ['to=' + contract.contract_details.eth_contract.address, 'data=0x41c0e1b5', 'gaslimit=40000', 'value=0'];
        contract.depositUrl = depositUrl + '&' + depositParams.join('&');
        contract.killUrl = killUrl + '&' + killParams.join('&');
        contract.willCode = JSON.stringify(contract.contract_details.eth_contract.abi||{});

        if ((contract.contract_type === 8) && contract.contract_details.processing_count) {
            contract.state = 'SENDING_TOKENS';
        }

    };

    $scope.goToContract = function(contract, $event) {
        var target = angular.element($event.target);
        if (target.is('.btn') || target.parents('.btn').length) return;
        var contractId = contract.id;
        if ((contract.contract_type === 5) && (contract.state === 'UNDER_CROWDSALE')) {
            contractId = contract.contract_details.crowdsale || contractId;
        }
        $state.go('main.contracts.preview.byId', {id: contractId});
    };

    var updateList = function() {
        $rootScope.commonOpenedPopupParams = false;
        $rootScope.commonOpenedPopup = false;
        $state.transitionTo($state.current, {}, {
            reload: true,
            inherit: false,
            notify: true
        });
    };

    $scope.$on('$userUpdated', updateList);

    $scope.deleteContract = function(contract) {
        $scope.$parent.deleteContract(contract, function() {
            $scope.contractsList = $scope.contractsList.filter(function(contractItem) {
                return contract !== contractItem;
            });
        });
    };

    var contractsUpdateProgress = false;
    var getContracts = function() {
        if (contractsUpdateProgress) return;
        if (contractsData.count === $scope.contractsList.length) return;
        contractsUpdateProgress = true;
        contractService.getContractsList({
            limit: 8,
            offset: $scope.contractsList.length
        }).then(function(response) {
            contractsData = response.data;
            $scope.contractsList = $scope.contractsList.concat(response.data.results);
            contractsUpdateProgress = false;
        });
    };
    $scope.contractsListParams = {
        updater: getContracts,
        offset: 100
    };

}).controller('baseContractsController', function($scope, $state, $timeout, contractService, $rootScope, $interval) {
    var deletingProgress;
    $scope.refreshInProgress = {};
    $scope.timeoutsForProgress = {};

    /* (Click) Deleting contract */
    $scope.deleteContract = function(contract, callback) {
        if (deletingProgress) return;
        deletingProgress = true;
        contractService.deleteContract(contract.id).then(function() {
            deletingProgress = false;
            callback ? callback() : $state.go('main.contracts.list');
        }, function() {
            deletingProgress = false;
            callback ? callback() : false;
        });
    };

    /* (Click) Contract refresh */
    $scope.refreshContract = function(contract) {
        var contractId = contract.id;
        if ($scope.timeoutsForProgress[contractId]) return;
        $scope.refreshInProgress[contractId] = true;
        $scope.timeoutsForProgress[contractId] = $interval(function() {
            if (!$scope.refreshInProgress[contractId]) {
                $interval.cancel($scope.timeoutsForProgress[contractId]);
                $scope.timeoutsForProgress[contractId] = false;
            }
        }, 1000);
        contractService.getContract(contractId).then(function(response) {
            angular.merge(contract, response.data);
            $scope.refreshInProgress[contractId] = false;
        }, function() {
            $scope.refreshInProgress[contractId] = false;
        });
    };

    var launchProgress = false;

    var launchContract = function(contract) {
        if (launchProgress) return;
        launchProgress = true;
        contractService.deployContract(contract.id, contract.promo).then(function() {
            launchProgress = false;
            $rootScope.closeCommonPopup();

            var testNetwork = false;
            switch (contract.network) {
                case 1:
                case 3:
                case 5:
                    break;
                case 2:
                case 4:
                case 6:
                    testNetwork = true;
                    break;
            }
            var contractType;
            switch (contract.contract_type) {
                case 0:
                    contractType = 'will';
                    break;
                case 1:
                    contractType = 'lost_key';
                    break;
                case 2:
                    contractType = 'deferred';
                    break;
                case 4:
                    contractType = 'crowdsale';
                    break;
                case 5:
                    contractType = 'token';
                    break;
                case 6:
                    contractType = 'neo_token';
                    break;
                case 7:
                    contractType = 'neo_crowdsale';
                    break;
                default:
                    contractType = 'unknown';
            }

            dataLayer.push({'event': contractType + '_contract_launch_success' + (testNetwork ? '_test' : '')});

            if ($state.current.name === 'main.contracts.list') {
                $scope.refreshContract(contract);
            } else {
                $state.go('main.contracts.list');
            }
        }, function(data) {
            switch(data.status) {
                case 400:
                    switch(data.data.result) {
                        case 1:
                        case '1':
                            $rootScope.commonOpenedPopupParams = {
                                newPopupContent: true
                            };
                            $rootScope.commonOpenedPopup = 'errors/contract_date_incorrect';
                            break;
                        case 2:
                        case '2':
                            $rootScope.commonOpenedPopupParams = {
                                newPopupContent: true
                            };
                            $rootScope.commonOpenedPopup = 'errors/contract_freeze_date_incorrect';
                            break;
                    }
                    break;
            }
            launchProgress = false;
        });
    };

    /* (Click) Launch contract */
    $scope.payContract = function(contract) {
        if (contract.isDeployProgress) return;
        contract.discount = contract.discount || 0;

        $rootScope.getCurrentUser().then(function(data) {
            if ($rootScope.currentUser.is_ghost) {
                $rootScope.commonOpenedPopup = 'alerts/ghost-user-alarm';
                $rootScope.commonOpenedPopupParams = {
                    newPopupContent: true
                }
                return;
            }
            var openConditionsPopUp = function() {
                var originalCost = new BigNumber(contract.cost.WISH);
                var changedBalance = originalCost.minus(originalCost.times(contract.discount).div(100));
                if (new BigNumber($rootScope.currentUser.balance).minus(changedBalance) < 0) {
                    $rootScope.commonOpenedPopupParams = {
                        noBackgroundCloser: true,
                        newPopupContent: true
                    };
                    $rootScope.commonOpenedPopup = 'errors/less-balance';
                    return;
                }
                $rootScope.commonOpenedPopupParams = {
                    contract: contract,
                    class: 'conditions',
                    newPopupContent: true,
                    actions: {
                        showPriceLaunchContract: showPriceLaunchContract
                    }
                };
                $rootScope.commonOpenedPopup = 'disclaimers/conditions';
            };

            var promoIsEntered = $scope.getDiscount(contract);
            if (promoIsEntered) {
                promoIsEntered.then(openConditionsPopUp, openConditionsPopUp);
            } else {
                openConditionsPopUp();
            }
        }, function() {

        });
    };

    var showPriceLaunchContract = function(contract) {
        if (contract.cost.WISH == 0) {
            launchContract(contract);
            return;
        }
        $rootScope.commonOpenedPopup = 'confirmations/contract-confirm-pay';
        $rootScope.commonOpenedPopupParams = {
            newPopupContent: true,
            class: 'deleting-contract',
            contract: contract,
            confirmPayment: launchContract,
            contractCost: Web3.utils.fromWei(contract.cost.WISH, 'ether')
        };
    };

    $scope.getDiscount = function(contract) {
        if (!contract.promo) return;

        return contractService.getDiscount({
            contract_type: contract.contract_type,
            promo: contract.promo
        }).then(function(response) {
            contract.discount = response.data.discount;
            $rootScope.commonOpenedPopupParams = {
                contract: contract,
                newPopupContent: true
            };

            $rootScope.commonOpenedPopup = 'alerts/promo-code-activated';

        }, function(response) {
            contract.discount = 0;
            switch (response.status) {
                case 403:
                    contract.discountError = response.data.detail;
                    break;
            }
        });
    };

    $scope.neoCrowdSaleFinalize = function(contract) {
        contractService.neoICOFilnalize(contract.id).then(function(reponse) {
            $rootScope.commonOpenedPopup = 'alerts/neo-finalize-success';
            $scope.refreshContract(contract);
        }, function(reponse) {
            switch (reponse.status) {
                case 400:
                    switch(reponse.data.result) {
                        case 2:
                        case '2':
                            $rootScope.commonOpenedPopupParams = {
                                contract: contract
                            };
                            $rootScope.commonOpenedPopup = 'alerts/neo-finalize-denied';
                            break;
                    }
                    break;
            }
        });
    };

});

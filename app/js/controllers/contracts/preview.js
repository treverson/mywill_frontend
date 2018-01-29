angular.module('app').controller('contractsPreviewController', function($state, $scope, contractService, $rootScope, $timeout, CONTRACT_STATUSES_CONSTANTS) {
    var deletingProgress = false;
    $scope.statuses = CONTRACT_STATUSES_CONSTANTS;
    $scope.contract = false;

    var url = 'https://www.myetherwallet.com/?';
    var params = [
        'sendMode=ether'
    ];
    var depositUrl = url + params.join('&');
    var killUrl = url + params.join('&');

    $scope.setContract = function(contract) {
        $scope.contract = contract;
        $scope.contract.stateValue = $scope.statuses[$scope.contract.state]['value'];
        $scope.contract.stateTitle = $scope.statuses[$scope.contract.state]['title'];
        if (!contract.contract_details.eth_contract) return;
        var depositParams = ['to=' + contract.contract_details.eth_contract.address, 'gaslimit=30000', 'value=0'];
        var killParams = ['to=' + contract.contract_details.eth_contract.address, 'data=0x41c0e1b5', 'gaslimit=40000', 'value=0'];
        contract.depositUrl = depositUrl + '&' + depositParams.join('&');
        contract.killUrl = killUrl + '&' + killParams.join('&');
        contract.willCode = JSON.stringify(contract.contract_details.eth_contract.abi||{});
    };

    $scope.deleteContract = function() {
        deletingProgress = true;
        contractService.deleteContract($scope.contract.id).then(function() {
            deletingProgress = false;
            $state.go('main.contracts.list');
        }, function() {
            deletingProgress = false;
        });
    };


    $scope.successCodeCopy = function(contract, field) {
        contract.copied = contract.copied || {};
        contract.copied[field] = true;
        $timeout(function() {
            contract.copied[field] = false;
        }, 1000);
    };

    var launchProgress = false;
    var launchContract = function(contract) {
        launchProgress = true;
        $rootScope.commonOpenedPopup = false;
        contractService.deployContract(contract.id).then(function() {
            launchProgress = false;
            $state.go('main.contracts.list');
        }, function(data) {
            switch(data.status) {
                case 400:
                    switch(data.data.result) {
                        case 1:
                            $rootScope.commonOpenedPopup = 'contract_date_incorrect';
                            break;
                    }
                    break;
            }
            launchProgress = false;
        });
    };

    $scope.payContract = function() {
        var contract = $scope.contract;
        $rootScope.getCurrentUser().then(function(data) {
            if ($rootScope.currentUser.is_ghost) {
                $rootScope.commonOpenedPopup = 'ghost-user-alarm';
                return;
            }
            if (new BigNumber($rootScope.currentUser.balance).minus(new BigNumber(contract.cost)) < 0) {
                $rootScope.commonOpenedPopup = 'less-balance';
                return;
            }

            $rootScope.commonOpenedPopupParams = {
                contract: contract,
                withoutCloser: true,
                class: 'conditions',
                endPay: {
                    contract: contract,
                    confirmPayment: launchContract,
                    contractCost: new BigNumber(contract.cost).div(Math.pow(10, 18)).round(2).toString(10),
                    withoutCloser: true
                }
            };
            $rootScope.commonOpenedPopup = 'conditions';
        }, function() {
        });
    };
});

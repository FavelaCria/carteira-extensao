import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import {
  CUSTOM_GAS_ESTIMATE,
  GAS_RECOMMENDATIONS,
  EDIT_GAS_MODES,
} from '../../../shared/constants/gas';
import { GAS_FORM_ERRORS } from '../../helpers/constants/gas';
import { areDappSuggestedAndTxParamGasFeesTheSame } from '../../helpers/utils/confirm-tx.util';
import {
  checkNetworkAndAccountSupports1559,
  getAdvancedInlineGasShown,
} from '../../selectors';
import { hexToDecimal } from '../../helpers/utils/conversions.util';
import { isLegacyTransaction } from '../../helpers/utils/transactions.util';
import { useGasFeeEstimates } from '../useGasFeeEstimates';

import { useGasFeeErrors } from './useGasFeeErrors';
import { useGasPriceInput } from './useGasPriceInput';
import { useMaxFeePerGasInput } from './useMaxFeePerGasInput';
import { useMaxPriorityFeePerGasInput } from './useMaxPriorityFeePerGasInput';
import { useGasEstimates } from './useGasEstimates';
import { useTransactionFunctions } from './useTransactionFunctions';

/**
 * @typedef {Object} GasFeeInputReturnType
 * @property {DecGweiString} [maxFeePerGas] - the maxFeePerGas input value.
 * @property {string} [maxFeePerGasFiat] - the maxFeePerGas converted to the
 *  user's preferred currency.
 * @property {(DecGweiString) => void} setMaxFeePerGas - state setter method to
 *  update the maxFeePerGas.
 * @property {DecGweiString} [maxPriorityFeePerGas] - the maxPriorityFeePerGas
 *  input value.
 * @property {string} [maxPriorityFeePerGasFiat] - the maxPriorityFeePerGas
 *  converted to the user's preferred currency.
 * @property {(DecGweiString) => void} setMaxPriorityFeePerGas - state setter
 *  method to update the maxPriorityFeePerGas.
 * @property {DecGweiString} [gasPrice] - the gasPrice input value.
 * @property {(DecGweiString) => void} setGasPrice - state setter method to
 *  update the gasPrice.
 * @property {DecGweiString} gasLimit - the gasLimit input value.
 * @property {(DecGweiString) => void} setGasLimit - state setter method to
 *  update the gasLimit.
 * @property {EstimateLevel} [estimateToUse] - the estimate level currently
 *  selected. This will be null if the user has ejected from using the
 *  estimates.
 * @property {([EstimateLevel]) => void} setEstimateToUse - Setter method for
 *  choosing which EstimateLevel to use.
 * @property {string} [estimatedMinimumFiat] - The amount estimated to be paid
 *  based on current network conditions. Expressed in user's preferred
 *  currency.
 * @property {string} [estimatedMaximumFiat] - the maximum amount estimated to be
 *  paid if current network transaction volume increases. Expressed in user's
 *  preferred currency.
 * @property {string} [estimatedMaximumNative] - the maximum amount estimated to
 *  be paid if the current network transaction volume increases. Expressed in
 *  the network's native currency.
 */

/**
 * Uses gasFeeEstimates and state to keep track of user gas fee inputs.
 * Will update the gas fee state when estimates update if the user has not yet
 * modified the fields.
 * @param {EstimateLevel} defaultEstimateToUse - which estimate
 *  level to default the 'estimateToUse' state variable to.
 * @returns {GasFeeInputReturnType & import(
 *  './useGasFeeEstimates'
 * ).GasEstimates} - gas fee input state and the GasFeeEstimates object
 */
export function useGasFeeInputs(
  defaultEstimateToUse = GAS_RECOMMENDATIONS.MEDIUM,
  transaction,
  minimumGasLimit = '0x5208',
  editGasMode = EDIT_GAS_MODES.MODIFY_IN_PLACE,
) {
  const supportsEIP1559 =
    useSelector(checkNetworkAndAccountSupports1559) &&
    !isLegacyTransaction(transaction?.txParams);

  // We need the gas estimates from the GasFeeController in the background.
  // Calling this hooks initiates polling for new gas estimates and returns the
  // current estimate.
  const {
    gasEstimateType,
    gasFeeEstimates,
    isGasEstimatesLoading,
    estimatedGasFeeTimeBounds,
  } = useGasFeeEstimates();

  const userPrefersAdvancedGas = useSelector(getAdvancedInlineGasShown);

  const [estimateToUse, setInternalEstimateToUse] = useState(() => {
    if (
      userPrefersAdvancedGas &&
      transaction?.txParams?.maxPriorityFeePerGas &&
      transaction?.txParams?.maxFeePerGas
    )
      return null;
    if (transaction) return transaction?.userFeeLevel || null;
    return defaultEstimateToUse;
  });

  const [estimateUsed, setEstimateUsed] = useState(() => {
    if (areDappSuggestedAndTxParamGasFeesTheSame(transaction)) {
      return 'dappSuggested';
    }
    return estimateToUse;
  });

  /**
   * In EIP-1559 V2 designs change to gas estimate is always updated to transaction
   * Thus callback setEstimateToUse can be deprecate in favour of this useEffect
   * so that transaction is source of truth whenever possible.
   */
  useEffect(() => {
    if (areDappSuggestedAndTxParamGasFeesTheSame(transaction)) {
      setEstimateUsed('dappSuggested');
    } else if (transaction?.userFeeLevel) {
      setEstimateUsed(transaction?.userFeeLevel);
    }
  }, [setEstimateUsed, transaction]);

  const [gasLimit, setGasLimit] = useState(() =>
    Number(hexToDecimal(transaction?.txParams?.gas ?? '0x0')),
  );

  const {
    gasPrice,
    setGasPrice,
    setGasPriceHasBeenManuallySet,
  } = useGasPriceInput({
    estimateToUse,
    gasEstimateType,
    gasFeeEstimates,
    transaction,
  });

  const {
    maxFeePerGas,
    maxFeePerGasFiat,
    setMaxFeePerGas,
  } = useMaxFeePerGasInput({
    estimateToUse,
    gasEstimateType,
    gasFeeEstimates,
    gasLimit,
    gasPrice,
    transaction,
  });

  const {
    maxPriorityFeePerGas,
    maxPriorityFeePerGasFiat,
    setMaxPriorityFeePerGas,
  } = useMaxPriorityFeePerGasInput({
    estimateToUse,
    gasEstimateType,
    gasFeeEstimates,
    gasLimit,
    transaction,
  });

  const {
    estimatedBaseFee,
    estimatedMaximumFiat,
    estimatedMinimumFiat,
    estimatedMaximumNative,
    estimatedMinimumNative,
    minimumCostInHexWei,
  } = useGasEstimates({
    editGasMode,
    gasEstimateType,
    gasFeeEstimates,
    gasLimit,
    gasPrice,
    maxFeePerGas,
    maxPriorityFeePerGas,
    minimumGasLimit,
    transaction,
  });

  const {
    balanceError,
    estimatesUnavailableWarning,
    gasErrors,
    gasWarnings,
    hasGasErrors,
  } = useGasFeeErrors({
    gasEstimateType,
    gasFeeEstimates,
    isGasEstimatesLoading,
    gasLimit,
    gasPrice,
    maxPriorityFeePerGas,
    maxFeePerGas,
    minimumCostInHexWei,
    minimumGasLimit,
    transaction,
  });

  const handleGasLimitOutOfBoundError = useCallback(() => {
    if (gasErrors.gasLimit === GAS_FORM_ERRORS.GAS_LIMIT_OUT_OF_BOUNDS) {
      const transactionGasLimitDec = hexToDecimal(transaction?.txParams?.gas);
      const minimumGasLimitDec = hexToDecimal(minimumGasLimit);
      setGasLimit(
        transactionGasLimitDec > minimumGasLimitDec
          ? transactionGasLimitDec
          : minimumGasLimitDec,
      );
    }
  }, [minimumGasLimit, gasErrors.gasLimit, transaction]);

  const { updateTransactionUsingGasFeeEstimates } = useTransactionFunctions({
    defaultEstimateToUse,
    gasLimit,
    gasPrice,
    maxFeePerGas,
    maxPriorityFeePerGas,
    gasFeeEstimates,
    supportsEIP1559,
    transaction,
  });

  // When a user selects an estimate level, it will wipe out what they have
  // previously put in the inputs. This returns the inputs to the estimated
  // values at the level specified.
  const setEstimateToUse = useCallback(
    (estimateLevel) => {
      setInternalEstimateToUse(estimateLevel);
      handleGasLimitOutOfBoundError();
      setMaxFeePerGas(null);
      setMaxPriorityFeePerGas(null);
      setGasPrice(null);
      setGasPriceHasBeenManuallySet(false);
      setEstimateUsed(estimateLevel);
    },
    [
      setInternalEstimateToUse,
      handleGasLimitOutOfBoundError,
      setMaxFeePerGas,
      setMaxPriorityFeePerGas,
      setGasPrice,
      setGasPriceHasBeenManuallySet,
      setEstimateUsed,
    ],
  );

  const onManualChange = useCallback(() => {
    setInternalEstimateToUse(CUSTOM_GAS_ESTIMATE);
    handleGasLimitOutOfBoundError();
    // Restore existing values
    setGasPrice(gasPrice);
    setGasLimit(gasLimit);
    setMaxFeePerGas(maxFeePerGas);
    setMaxPriorityFeePerGas(maxPriorityFeePerGas);
    setGasPriceHasBeenManuallySet(true);
    setEstimateUsed('custom');
  }, [
    setInternalEstimateToUse,
    handleGasLimitOutOfBoundError,
    setGasPrice,
    gasPrice,
    setGasLimit,
    gasLimit,
    setMaxFeePerGas,
    maxFeePerGas,
    setMaxPriorityFeePerGas,
    maxPriorityFeePerGas,
    setGasPriceHasBeenManuallySet,
  ]);

  return {
    transaction,
    maxFeePerGas,
    maxFeePerGasFiat,
    setMaxFeePerGas,
    maxPriorityFeePerGas,
    maxPriorityFeePerGasFiat,
    setMaxPriorityFeePerGas,
    gasPrice,
    setGasPrice,
    gasLimit,
    setGasLimit,
    estimateToUse,
    setEstimateToUse,
    estimatedMinimumFiat,
    estimatedMaximumFiat,
    estimatedMaximumNative,
    estimatedMinimumNative,
    isGasEstimatesLoading,
    estimateUsed,
    gasFeeEstimates,
    gasEstimateType,
    estimatedGasFeeTimeBounds,
    onManualChange,
    estimatedBaseFee,
    // error and warnings
    balanceError,
    estimatesUnavailableWarning,
    gasErrors,
    gasWarnings,
    hasGasErrors,
    supportsEIP1559,
    updateTransactionUsingGasFeeEstimates,
  };
}

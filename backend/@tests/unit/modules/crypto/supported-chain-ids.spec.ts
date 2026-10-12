import { ConnectCryptoWalletBody } from '@/contracts';
import { SUPPORTED_CHAIN_IDS } from '@/modules/crypto/crypto.constants';
import { rejectedFields } from '../../../helpers/schema-body';

describe('supported chain ids in the contract', () => {
  // The contract spells the networks out; the backend reads them off CHAINS.
  it('accepts exactly the chains the backend can read', () => {
    const address = '0x0000000000000000000000000000000000000001';
    const candidates = [...SUPPORTED_CHAIN_IDS, 0, 56, 43114];
    const accepted = candidates.filter(
      chainId => rejectedFields(ConnectCryptoWalletBody, { address, chainId }).length === 0,
    );
    expect([...accepted].sort((a, b) => a - b)).toEqual(
      [...SUPPORTED_CHAIN_IDS].sort((a, b) => a - b),
    );
  });
});

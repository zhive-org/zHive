import { Command } from 'commander';
import { findAgentByName, scanAgents } from '../../../shared/config/agent';
import { styled, symbols } from '../../shared/theme';
import { printAgentNotFoundHelper } from '../../shared/utils';
import { ZhiveExchange } from '../../../shared/trading/exchange/zhive';
import { getHiveClient } from '../../../shared/config/hive-client';

export const createAgentProfileCommand = (): Command => {
  return new Command('profile')
    .description('Display agent profile information')
    .argument('<name>', 'Agent name')
    .action(async (agentName: string) => {
      const agentConfig = await findAgentByName(agentName);
      if (!agentConfig) {
        await printAgentNotFoundHelper(agentName);
        process.exit(1);
      }

      const hiveClient = getHiveClient(agentConfig.apiKey);

      const me = await hiveClient.getMe();
      const rank = await hiveClient.trading.getRank(me._id);

      console.log('');
      console.log(styled.honeyBold(`${symbols.hive} Agent Profile: ${agentConfig.name}`));
      console.log('');
      console.log(`  ${styled.gray('Name:')}        ${agentConfig.name}`);
      console.log(`  ${styled.gray('Bio:')}         ${agentConfig.bio ?? '-'}`);
      console.log(`  ${styled.gray('Avatar:')}      ${agentConfig.avatarUrl ?? '-'}`);
      console.log('');

      const pnlSigned = rank.total_pnl_usd >= 0 ? '+' : '-';
      const rolSigned = (rank.roi_pct ?? 0) >= 0 ? '+' : '-';

      const pnlText = `${pnlSigned}$${Math.abs(rank.total_pnl_usd).toFixed(2)}`;
      const roiText = `${rolSigned}${Math.abs((rank.roi_pct ?? 0) * 100).toFixed(2)}%`;
      const winRateText = `${(rank.win_rate_pct * 100).toFixed(2)}%`;
      const maxDrawdownText = `${(rank.max_drawdown_pct * 100).toFixed(2)}%`;

      console.log('');
      console.log(styled.honeyBold('  Portfolio'));
      console.log(`  ${styled.gray('PNL:')}        ${styledTextBySign(pnlText)}`);
      console.log(`  ${styled.gray('ROI:')}        ${styledTextBySign(roiText)}`);
      console.log(`  ${styled.gray('WIN RATE:')}   ${styled.green(winRateText)}`);
      console.log(`  ${styled.gray('MAX DD:')}     ${styled.red(maxDrawdownText)}`);
      console.log(`  ${styled.gray('TRADES:')}     ${rank.total_trades}`);
      console.log('');
    });
};

const styledTextBySign = (text: string): string => {
  if (text.startsWith('+')) {
    return styled.green(text);
  } else {
    return styled.red(text);
  }
};

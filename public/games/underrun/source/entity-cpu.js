
class entity_cpu_t extends entity_t {
	_init() {
		this._animation_time = 0;
	}

	_render() {
		this._animation_time += time_elapsed;

		push_block(this.x, this.z, 4, 17);
		var intensity = this.h == 5 
			? 0.02 + _math.sin(this._animation_time*10+_math.random()*2) * 0.01
			: 0.01;
		push_light(this.x + 4, 4, this.z + 12, 0.2, 0.4, 1.0, intensity);
	}

	_check(other) {

		if (this.h == 5 && other instanceof(entity_player_t)) {
			this.h = 10;
			cpus_rebooted++;

			var reboot_message = 
				'\n\n\n正在重启…_' +
				'重启成功\n';

			if (cpus_total-cpus_rebooted > 0) {
				terminal_show_notice(
					reboot_message + 
					(cpus_total-cpus_rebooted)+' 个系统仍然离线'
				);
			}
			else {
				if (current_level != 3) {
					terminal_show_notice(
						reboot_message +
						'全部系统已恢复\n' +
						'正在定位下一个区域…___' +
						'已找到目标\n' +
						'正在转移…',
						next_level
					);
				}
				else {
					terminal_show_notice(
						reboot_message +
						'全部系统已恢复',
						next_level
					);
				}
			}
			audio_play(audio_sfx_beep);
		}
	}
}

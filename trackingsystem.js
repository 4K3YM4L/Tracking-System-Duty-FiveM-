const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

// --- KONFIGURASI ---
const TOKEN = '####'; 
const SOURCE_CHANNEL_ID = '####';
const TARGET_CHANNEL_ID = '####';

const DATABASE_PEGAWAI = {
    "license:51fe139517850adc16a33ef7074a0a3d92828cfd": "Nama Pertama",
    "license:b7ba68649c151a10e54a25210e1022dd5669d5e8": "Nama Kedua"
};

let dutySessions = {}; 
let dailyTracker = {
    date: new Date().toLocaleDateString('en-GB'),
    counts: {} // Menyimpan jumlah trigger harian
};

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent
    ]
});

// Fungsi Format Masa
function formatDuration(ms) {
    let seconds = Math.floor((ms / 1000) % 60);
    let minutes = Math.floor((ms / (1000 * 60)) % 60);
    let hours = Math.floor(ms / (1000 * 60 * 60));
    let output = "";
    if (hours > 0) output += `${hours} Jam `;
    if (minutes > 0) output += `${minutes} Minit `;
    output += `${seconds} Saat`;
    return output;
}

client.on('messageCreate', async (message) => {
    if (message.channelId !== SOURCE_CHANNEL_ID || message.author.id === client.user.id) return;

    const today = new Date().toLocaleDateString('en-GB');
    if (dailyTracker.date !== today) {
        dailyTracker.date = today;
        dailyTracker.counts = {};
    }

    let fullText = "";
    let statusDikesan = "UNKNOWN";
    let pangkat = "Tiada Maklumat";

    if (message.embeds.length > 0) {
        message.embeds.forEach(embed => {
            fullText += ` ${embed.description}`;
            if (embed.fields) {
                embed.fields.forEach(field => {
                    fullText += ` ${field.value}`;
                    const val = field.value.toLowerCase();
                    if (val.includes("on duty")) statusDikesan = "CLOCK IN (D4)";
                    if (val.includes("off duty")) statusDikesan = "CLOCK OUT (D4)";
                    if (field.name.toLowerCase().includes("pangkat")) pangkat = field.value;
                });
            }
        });
    }

    const senaraiLicense = Object.keys(DATABASE_PEGAWAI);
    const licenseDijumpai = senaraiLicense.find(lic => fullText.toLowerCase().includes(lic.toLowerCase()));

    if (licenseDijumpai) {
        const namaPaparan = DATABASE_PEGAWAI[licenseDijumpai];
        const masaSekarang = new Date();
        const targetChannel = await client.channels.fetch(TARGET_CHANNEL_ID);
        if (!targetChannel) return;

        // KEMASKINI COUNTER HARIAN (TRIGGER KE-X)
        if (!dailyTracker.counts[namaPaparan]) dailyTracker.counts[namaPaparan] = 0;
        dailyTracker.counts[namaPaparan] += 1;

        if (statusDikesan.includes("IN")) {
            // Semak jika gagal Off Duty sebelum ini
            if (dutySessions[namaPaparan]) {
                const masaLama = dutySessions[namaPaparan];
                const durasiTerbabas = formatDuration(masaSekarang - masaLama);

                const alertEmbed = new EmbedBuilder()
                    .setTitle('⚠️ AMARAN: GAGAL OFF DUTY')
                    .setColor(0xFFAC33)
                    .setDescription(`Pegawai **${namaPaparan}** dikesan memulakan sesi baru tanpa menutup sesi lama.`)
                    .addFields(
                        { name: 'Sesi Tergantung Selama', value: `\`${durasiTerbabas}\``, inline: true },
                        { name: 'Info Statistik', value: `Trigger ke-${dailyTracker.counts[namaPaparan]} (Amaran)`, inline: true }
                    )
                    .setTimestamp();

                await targetChannel.send({ embeds: [alertEmbed] });
            }
            
            dutySessions[namaPaparan] = masaSekarang;
            
            const inEmbed = new EmbedBuilder()
                .setTitle('SYSTEM TRACKING KEHADIRAN D4')
                .setColor(0x57F287)
                .addFields(
                    { name: '👤 Pegawai', value: `**${namaPaparan}**`, inline: true },
                    { name: '🎖️ Pangkat', value: `**${pangkat}**`, inline: true },
                    { name: '📊 Statistik', value: `\`Trigger ke-${dailyTracker.counts[namaPaparan]}\``, inline: true },
                    { name: '📝 Status', value: `🟢 **${statusDikesan}**`, inline: false },
                    { name: '⏳ Info', value: `Sesi Baru Bermula`, inline: false }
                )
                .setTimestamp();

            await targetChannel.send({ embeds: [inEmbed] });
        } 
        
        else if (statusDikesan.includes("OUT")) {
            let durasiTeks = "Masa mula tidak dikesan.";
            if (dutySessions[namaPaparan]) {
                durasiTeks = formatDuration(masaSekarang - dutySessions[namaPaparan]);
                delete dutySessions[namaPaparan];
            }

            const outEmbed = new EmbedBuilder()
                .setTitle('SYSTEM TRACKING KEHADIRAN D4')
                .setColor(0xED4245)
                .addFields(
                    { name: '👤 Pegawai', value: `**${namaPaparan}**`, inline: true },
                    { name: '🎖️ Pangkat', value: `**${pangkat}**`, inline: true },
                    { name: '📊 Statistik', value: `\`Trigger ke-${dailyTracker.counts[namaPaparan]}\``, inline: true },
                    { name: '📝 Status', value: `🔴 **${statusDikesan}**`, inline: false },
                    { name: '⏳ Tempoh Duty', value: `**${durasiTeks}**`, inline: false }
                )
                .setTimestamp();

            await targetChannel.send({ embeds: [outEmbed] });
        }
    }
});

client.once('ready', () => console.log(`Bot Tracking D4 (Full Features) Online!`));
client.login(TOKEN);
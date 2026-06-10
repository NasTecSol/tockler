const fs = require('fs');
const path = require('path');

const filesToUpdate = [
    'README.md',
    'electron/src/app/menu-builder.ts',
    'electron/src/app/app-updater.ts',
    'electron/sonar-project.properties',
    'electron/package.json',
    'client/sonar-project.properties',
    'client/src/routes/SupportPage.tsx'
];

function replaceInFile(filePath) {
    const absolutePath = path.join(process.cwd(), filePath);
    if (!fs.existsSync(absolutePath)) {
        console.error(`File not found: ${absolutePath}`);
        return;
    }
    
    let content = fs.readFileSync(absolutePath, 'utf8');

    // For Sonar Cloud properties
    if (filePath.includes('sonar-project.properties')) {
        content = content.replace(/maygo_tockler/g, 'nastecsol_tockler');
        content = content.replace(/sonar\.organization=maygo/g, 'sonar.organization=nastecsol');
    }

    // General replacements
    content = content.replace(/MayGo\/tockler/ig, 'NasTecSol/tockler');
    content = content.replace(/(?<=github.com\/sponsors\/)maygo/ig, 'NasTecSol');
    content = content.replace(/\(https:\/\/github.com\/MayGo\)/ig, '(https://github.com/NasTecSol)');
    // replace any leftover maygo shields
    content = content.replace(/maygo\/tockler/ig, 'NasTecSol/tockler');
    content = content.replace(/sponsors\/maygo/ig, 'sponsors/NasTecSol');

    content = content.replace(/author": "Maigo Erit <maigo.erit@gmail.com>"/gi, 'author": "NasTecSol"');
    
    // Check if we should replace raw exact MayGo references:
    if (filePath.includes('package.json')) {
         content = content.replace(/MayGo/g, 'NasTecSol');
    }

    fs.writeFileSync(absolutePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
}

filesToUpdate.forEach(replaceInFile);
